import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { fulfillments, notificationOutbox, orders, webhookEvents } from "@/db/schema";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";
import { listReviewsByStatus } from "@/lib/commerce/reviews";

export const dynamic = "force-dynamic";
export const metadata = { title: "Commerce Operations", robots: { index: false, follow: false } };

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);

export default async function OpsPage() {
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  if (!verifyOpsSessionToken(token)) redirect("/ops/login");
  const [recentOrders, failedWebhooks, manualReview, pendingEmail, pendingReviews] = await Promise.all([
    db().select().from(orders).orderBy(desc(orders.createdAt)).limit(30),
    db().select().from(webhookEvents).where(eq(webhookEvents.processingStatus, "failed")).orderBy(desc(webhookEvents.createdAt)).limit(20),
    db().select().from(fulfillments).where(eq(fulfillments.status, "manual_review")).orderBy(desc(fulfillments.updatedAt)).limit(20),
    db().select().from(notificationOutbox).where(eq(notificationOutbox.status, "pending")).orderBy(desc(notificationOutbox.createdAt)).limit(50),
    listReviewsByStatus("pending", 100),
  ]);
  return <main className="px-4 pb-24 pt-28 md:px-6"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-end justify-between gap-6 border-t-2 border-accent pt-5">
      <div><p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">Production commerce</p><h1 className="mt-3 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Operations</h1></div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/ops/reviews" className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Reviews{pendingReviews.length ? ` · ${pendingReviews.length} pending` : ""}</Link>
        <form action="/api/ops/session" method="post"><input type="hidden" name="_method" value="delete" /><button formAction="/api/ops/logout" className="min-h-11 border border-border/60 px-4 py-2 font-mono text-xs font-bold uppercase">Sign out</button></form>
      </div>
    </header>
    <section className="mt-10 grid gap-3 sm:grid-cols-4">
      {[["Recent orders", recentOrders.length], ["Manual review", manualReview.length], ["Pending email", pendingEmail.length], ["Failed webhooks", failedWebhooks.length]].map(([label,value]) => <div key={String(label)} className="border-t border-border/60 py-5"><p className="font-mono text-xs uppercase text-muted">{label}</p><p className="mt-2 font-display text-4xl font-black">{value}</p></div>)}
    </section>
    <p className="mt-4 font-mono text-xs uppercase text-muted">Fulfillment mode: {process.env.AHA_FULFILLMENT_MODE || "manual"} · Transactional email: {process.env.RESEND_API_KEY ? "configured" : "awaiting provider key"}</p>
    <section className="mt-10 border-y border-border/40 py-6" aria-labelledby="checks-title"><h2 id="checks-title" className="font-display text-xl font-black uppercase">Provider checks</h2><p className="mt-2 max-w-2xl text-sm text-muted">These perform read-only provider checks or send provider test events only. They do not charge a card, create a customer order, or confirm fulfillment. The email test sends one branded system message to support.</p><div className="mt-5 flex flex-wrap gap-3"><form action="/api/ops/provider-health" method="post"><button className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Check provider access</button></form><form action="/api/ops/webhooks/square-test" method="post"><button className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Test Square webhook</button></form><form action="/api/ops/webhooks/printful-test" method="post"><button className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Test Printful webhook</button></form><form action="/api/ops/email-test" method="post"><button className="min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase text-accent">Test order email</button></form></div></section>
    <section className="mt-12" aria-labelledby="orders-title"><h2 id="orders-title" className="font-display text-2xl font-black uppercase">Orders</h2>
      {recentOrders.length === 0 ? <p className="mt-4 border-y border-border/40 py-6 text-sm text-muted">No production orders yet. The first completed checkout will appear here.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border/60 font-mono text-xs uppercase text-muted"><tr><th className="py-3 pr-4">Order</th><th className="py-3 pr-4">Placed</th><th className="py-3 pr-4">Payment</th><th className="py-3 pr-4">Fulfillment</th><th className="py-3 pr-4">Total</th><th className="py-3">Action</th></tr></thead><tbody>{recentOrders.map((order) => <tr key={order.id} className="border-b border-border/30"><td className="py-4 pr-4 font-mono font-bold">{order.externalOrderNumber}</td><td className="py-4 pr-4 text-muted">{order.createdAt.toLocaleString()}</td><td className="py-4 pr-4">{order.paymentStatus}</td><td className="py-4 pr-4">{order.fulfillmentStatus}</td><td className="py-4 pr-4 font-mono">{money(order.totalAmount, order.currency)}</td><td className="py-4"><form action={`/api/ops/orders/${order.id}/retry`} method="post"><button disabled={order.paymentStatus !== 'paid'} className="min-h-11 border border-border/60 px-3 py-2 font-mono text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40">Retry fulfillment</button></form></td></tr>)}</tbody></table></div>}
    </section>
  </div></main>;
}
