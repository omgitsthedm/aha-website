import Link from "next/link";
import Script from "next/script";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { fulfillments, notificationOutbox, orders, webhookEvents } from "@/db/schema";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";
import { groupFulfillmentsByOrder } from "@/lib/commerce/fulfillment-state";
import { listReviewsByStatus } from "@/lib/commerce/reviews";

export const dynamic = "force-dynamic";
export const metadata = { title: "Commerce Operations", robots: { index: false, follow: false } };

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);

// Every APLIIQ support claim starts with their order id, so it has to be on the
// page. It used to exist only in SQL: the manual-review rows were counted and
// then thrown away without ever being rendered.
const providerRef = (row: { fulfillmentProvider: string; providerOrderId: string | null; printfulOrderId: string | null }) =>
  `${row.fulfillmentProvider}:${row.providerOrderId || row.printfulOrderId || "no-provider-id"}`;

// An APLIIQ claim that has not reached the provider is the only thing the
// break-glass release can act on. Offering the action anywhere else would hand
// the operator a button whose only possible answer is a 409.
const awaitsApliiqRelease = (row: { fulfillmentProvider: string; providerOrderId: string | null }) =>
  row.fulfillmentProvider === "apliiq" && !row.providerOrderId;

const ACTION_BUTTON = "min-h-11 border border-border/60 px-3 py-2 font-mono text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40";
const RELEASE_BUTTON = "min-h-11 border border-accent px-3 py-2 font-mono text-xs font-bold uppercase text-accent disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Progressive enhancement for the per-order ops actions, and nothing else.
 *
 * Every one of these endpoints answers a refusal as JSON — the release route
 * because the absence evidence IS the reason to trust it, retry and acknowledge
 * because a 303 back to an unchanged page is indistinguishable from success.
 * Without this the operator reads that JSON on a bare browser error page; with
 * it the same body is rendered in place. Submitting normally is the fallback,
 * so the reason is visible either way.
 */
const OPS_ACTION_SCRIPT = `(function () {
  if (typeof window.fetch !== 'function' || !document.body) return;

  function render(failed, title, message, payload) {
    var box = document.getElementById('ops-action-status');
    var heading = document.getElementById('ops-action-status-title');
    var detail = document.getElementById('ops-action-status-detail');
    var evidence = document.getElementById('ops-action-status-evidence');
    if (!box || !heading || !detail || !evidence) return;
    heading.textContent = title;
    heading.className = 'mt-3 font-mono text-xs font-bold uppercase ' + (failed ? 'text-error' : 'text-accent');
    detail.textContent = message;
    detail.className = 'mt-2 max-w-3xl whitespace-pre-wrap text-sm ' + (failed ? 'text-error' : 'text-muted');
    if (payload) { evidence.textContent = JSON.stringify(payload, null, 2); evidence.hidden = false; }
    else { evidence.textContent = ''; evidence.hidden = true; }
    box.hidden = false;
    box.scrollIntoView({ block: 'center' });
  }

  // Delegated, so the handler survives a client-side navigation that replaces
  // the table. next/script will not re-run an inline script it has already
  // loaded, and per-form listeners would be lost with the old rows.
  document.addEventListener('submit', function (event) {
    var target = event.target;
    var form = target && target.closest ? target.closest('form[data-ops-action]') : null;
    if (!form) return;
    event.preventDefault();
    var label = form.getAttribute('data-ops-action') || 'Action';
    var button = form.querySelector('button');
    if (button) button.disabled = true;
    render(false, label + ' \u2014 working', 'Waiting on the operations API.', null);
    fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (response) {
        return response.text().then(function (text) {
          var payload = null;
          try { payload = JSON.parse(text); } catch (parseError) { payload = null; }
          return { response: response, payload: payload };
        });
      })
      .then(function (result) {
        var response = result.response;
        var payload = result.payload;
        if (!payload) {
          // The 303 was followed back to /ops: the changed rows are the report,
          // so show them rather than invent a message.
          if (response.ok) { window.location.assign('/ops'); return; }
          render(true, label + ' \u2014 HTTP ' + response.status, 'The operations API answered ' + response.status + ' with no JSON body.', null);
          return;
        }
        if (response.ok && payload.ok !== false) {
          render(false, label + ' \u2014 done', payload.note || 'Completed. Refresh to load the updated rows.', payload);
          return;
        }
        render(true, label + ' \u2014 HTTP ' + response.status, payload.error || payload.reason || 'The operations API declined this action.', payload);
      })
      .catch(function (error) {
        render(true, label + ' \u2014 failed', error && error.message ? error.message : String(error), null);
      })
      .then(function () { if (button) button.disabled = false; });
  });
})();`;

export default async function OpsPage() {
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  if (!verifyOpsSessionToken(token)) redirect("/ops/login");
  const [recentOrders, failedWebhooks, attention, pendingEmail, pendingReviews] = await Promise.all([
    db().select().from(orders).orderBy(desc(orders.createdAt)).limit(30),
    db().select().from(webhookEvents).where(eq(webhookEvents.processingStatus, "failed")).orderBy(desc(webhookEvents.createdAt)).limit(20),
    // attention_at is a flag that survives a later status change, so a row that
    // has moved on from manual_review is still listed until it is dealt with.
    db().select({
      id: fulfillments.id, orderId: fulfillments.orderId, orderNumber: orders.externalOrderNumber,
      fulfillmentProvider: fulfillments.fulfillmentProvider, status: fulfillments.status,
      providerOrderId: fulfillments.providerOrderId, providerRequestId: fulfillments.providerRequestId,
      providerReference: fulfillments.providerReference, printfulOrderId: fulfillments.printfulOrderId,
      lastError: fulfillments.lastError, attentionAt: fulfillments.attentionAt,
      attentionReason: fulfillments.attentionReason, updatedAt: fulfillments.updatedAt,
    }).from(fulfillments).leftJoin(orders, eq(fulfillments.orderId, orders.id))
      .where(or(eq(fulfillments.status, "manual_review"), isNotNull(fulfillments.attentionAt)))
      .orderBy(desc(fulfillments.updatedAt)).limit(20),
    db().select().from(notificationOutbox).where(eq(notificationOutbox.status, "pending")).orderBy(desc(notificationOutbox.createdAt)).limit(50),
    listReviewsByStatus("pending", 100),
  ]);
  const orderIds = recentOrders.map((order) => order.id);
  const orderFulfillments = orderIds.length === 0 ? [] : await db().select({
    id: fulfillments.id, orderId: fulfillments.orderId, fulfillmentProvider: fulfillments.fulfillmentProvider,
    status: fulfillments.status, providerOrderId: fulfillments.providerOrderId,
    providerRequestId: fulfillments.providerRequestId, printfulOrderId: fulfillments.printfulOrderId,
    lastError: fulfillments.lastError, attentionReason: fulfillments.attentionReason,
  }).from(fulfillments).where(inArray(fulfillments.orderId, orderIds));
  const fulfillmentsByOrder = groupFulfillmentsByOrder(orderFulfillments);
  return <main className="px-4 pb-24 pt-28 md:px-6"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-end justify-between gap-6 border-t-2 border-accent pt-5">
      <div><p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">Production commerce</p><h1 className="mt-3 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Operations</h1></div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/ops/reviews" className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Reviews{pendingReviews.length ? ` · ${pendingReviews.length} pending` : ""}</Link>
        <form action="/api/ops/session" method="post"><input type="hidden" name="_method" value="delete" /><button formAction="/api/ops/logout" className="min-h-11 border border-border/60 px-4 py-2 font-mono text-xs font-bold uppercase">Sign out</button></form>
      </div>
    </header>
    <section className="mt-10 grid gap-3 sm:grid-cols-4">
      {[["Recent orders", recentOrders.length], ["Needs attention", attention.length], ["Pending email", pendingEmail.length], ["Failed webhooks", failedWebhooks.length]].map(([label,value]) => <div key={String(label)} className="border-t border-border/60 py-5"><p className="font-mono text-xs uppercase text-muted">{label}</p><p className="mt-2 font-display text-4xl font-black">{value}</p></div>)}
    </section>
    <p className="mt-4 font-mono text-xs uppercase text-muted">Fulfillment mode: {process.env.AHA_FULFILLMENT_MODE || "manual"} · APLIIQ orders: {process.env.APLIIQ_ALLOW_CREATE_ORDERS === "true" && process.env.APLIIQ_LIVE_MODE === "true" ? "armed" : "locked"} · Transactional email: {process.env.RESEND_API_KEY ? "configured" : "awaiting provider key"}</p>
    <section className="mt-10 border-y border-border/40 py-6" aria-labelledby="checks-title"><h2 id="checks-title" className="font-display text-xl font-black uppercase">Provider checks</h2><p className="mt-2 max-w-2xl text-sm text-muted">These perform read-only provider checks or send provider test events only. They do not charge a card, create a customer order, or confirm fulfillment. The email test sends one branded system message to support.</p><div className="mt-5 flex flex-wrap gap-3"><form action="/api/ops/provider-health" method="post"><button className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Check provider access</button></form><form action="/api/ops/webhooks/square-test" method="post"><button className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Test Square webhook</button></form><form action="/api/ops/webhooks/printful-test" method="post"><button className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Test Printful webhook</button></form><form action="/api/ops/email-test" method="post"><button className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Test order email</button></form></div></section>
    <section id="ops-action-status" hidden aria-live="polite" className="mt-10 border-y border-border/40 py-6" aria-labelledby="action-status-title">
      <h2 id="action-status-title" className="font-display text-xl font-black uppercase">Last action</h2>
      <p id="ops-action-status-title" className="mt-3 font-mono text-xs font-bold uppercase text-accent" />
      <p id="ops-action-status-detail" className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-muted" />
      <pre id="ops-action-status-evidence" hidden className="mt-3 max-w-3xl overflow-x-auto border border-border/40 p-3 font-mono text-xs text-muted" />
      <a href="/ops" className="mt-4 inline-block min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Refresh operations</a>
    </section>
    <section className="mt-12" aria-labelledby="orders-title"><h2 id="orders-title" className="font-display text-2xl font-black uppercase">Orders</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted">Retry fulfillment re-runs the ordinary path; it cannot release a gate-held APLIIQ claim and will say so rather than reload silently. Release APLIIQ hold is the break-glass path: it proves the provider does not already hold the order, then authorizes exactly one submission.</p>
      {recentOrders.length === 0 ? <p className="mt-4 border-y border-border/40 py-6 text-sm text-muted">No production orders yet. The first completed checkout will appear here.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="border-b border-border/60 font-mono text-xs uppercase text-muted"><tr><th className="py-3 pr-4">Order</th><th className="py-3 pr-4">Placed</th><th className="py-3 pr-4">Payment</th><th className="py-3 pr-4">Fulfillment</th><th className="py-3 pr-4">Provider order</th><th className="py-3 pr-4">Total</th><th className="py-3">Action</th></tr></thead><tbody>{recentOrders.map((order) => {
        const rows = fulfillmentsByOrder.get(order.id) ?? [];
        const paid = order.paymentStatus === "paid";
        const releasable = rows.some(awaitsApliiqRelease);
        return <tr key={order.id} className="border-b border-border/30"><td className="py-4 pr-4 font-mono font-bold">{order.externalOrderNumber}</td><td className="py-4 pr-4 text-muted">{order.createdAt.toLocaleString()}</td><td className="py-4 pr-4">{order.paymentStatus}</td><td className="py-4 pr-4">{order.fulfillmentStatus}</td><td className="py-4 pr-4 font-mono text-xs">{rows.length === 0 ? <span className="text-muted">Not submitted</span> : rows.map((row) => <span key={row.id} className="block py-0.5"><span className="font-bold">{providerRef(row)}</span>{row.providerRequestId ? <span className="block text-muted">req {row.providerRequestId}</span> : null}<span className="block text-muted">{row.status}</span>{row.lastError ? <span className="block text-error">{row.lastError}</span> : null}{row.attentionReason ? <span className="block text-error">attention: {row.attentionReason}</span> : null}</span>)}</td><td className="py-4 pr-4 font-mono">{money(order.totalAmount, order.currency)}</td><td className="py-4"><div className="flex flex-col items-start gap-2">
          <form data-ops-action="Retry fulfillment" action={`/api/ops/orders/${order.id}/retry`} method="post"><button disabled={!paid} className={ACTION_BUTTON}>Retry fulfillment</button></form>
          {releasable ? <form data-ops-action="Release APLIIQ hold" action={`/api/ops/orders/${order.id}/apliiq-resubmit`} method="post"><button disabled={!paid} className={RELEASE_BUTTON}>Release APLIIQ hold</button></form> : null}
        </div></td></tr>;
      })}</tbody></table></div>}
    </section>
    <section className="mt-12" aria-labelledby="attention-title"><h2 id="attention-title" className="font-display text-2xl font-black uppercase">Fulfillment attention</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">Provider rows in manual review, plus any row the scheduled APLIIQ sweep flagged. Quote the provider order id in every APLIIQ claim. Acknowledge clears the sweep flag once a human has dealt with the row — nothing else clears it.</p>
      {attention.length === 0 ? <p className="mt-4 border-y border-border/40 py-6 text-sm text-muted">Nothing is waiting on an operator.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1160px] text-left text-sm"><thead className="border-b border-border/60 font-mono text-xs uppercase text-muted"><tr><th className="py-3 pr-4">Order</th><th className="py-3 pr-4">Provider order</th><th className="py-3 pr-4">Request</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Reason</th><th className="py-3 pr-4">Updated</th><th className="py-3">Action</th></tr></thead><tbody>{attention.map((row) => <tr key={row.id} className="border-b border-border/30"><td className="py-4 pr-4 font-mono font-bold">{row.orderNumber || row.providerReference || (row.orderId === null ? "unlinked" : `#${row.orderId}`)}</td><td className="py-4 pr-4 font-mono text-xs">{providerRef(row)}</td><td className="py-4 pr-4 font-mono text-xs text-muted">{row.providerRequestId || "—"}</td><td className="py-4 pr-4">{row.status}{row.attentionAt ? <span className="block font-mono text-xs text-error">flagged {row.attentionAt.toLocaleString()}</span> : null}</td><td className="py-4 pr-4 text-xs text-error">{row.lastError ? <span className="block">{row.lastError}</span> : null}{row.attentionReason ? <span className="block">attention: {row.attentionReason}</span> : null}{row.lastError || row.attentionReason ? null : "—"}</td><td className="py-4 pr-4 font-mono text-xs text-muted">{row.updatedAt.toLocaleString()}</td><td className="py-4">{row.orderId === null ? <span className="font-mono text-xs text-muted">Unlinked row — resolve at the provider</span> : <div className="flex flex-col items-start gap-2">
        <form data-ops-action="Acknowledge attention" action={`/api/ops/orders/${row.orderId}/acknowledge-attention`} method="post"><button disabled={!row.attentionAt} className={ACTION_BUTTON}>Acknowledge</button></form>
        {awaitsApliiqRelease(row) ? <form data-ops-action="Release APLIIQ hold" action={`/api/ops/orders/${row.orderId}/apliiq-resubmit`} method="post"><button className={RELEASE_BUTTON}>Release APLIIQ hold</button></form> : null}
      </div>}</td></tr>)}</tbody></table></div>}
    </section>
    <Script id="ops-actions" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: OPS_ACTION_SCRIPT }} />
  </div></main>;
}
