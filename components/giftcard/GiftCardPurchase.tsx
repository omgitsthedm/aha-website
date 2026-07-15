"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { SquareWebPaymentsConfig } from "@/lib/commerce/runtime";

type TokenResult = { status: string; token: string };
type SquareCard = { attach: (s: string) => Promise<void>; tokenize: () => Promise<TokenResult> };
type SquarePaymentsApi = { card: () => Promise<SquareCard> };
// Access the SDK global via a local cast (the Window.Square augmentation lives
// in CheckoutForm; re-declaring it here would conflict).
const getSquare = (): { payments: (a: string, l: string) => SquarePaymentsApi } | undefined =>
  (window as unknown as { Square?: { payments: (a: string, l: string) => SquarePaymentsApi } }).Square;

const PRESETS = [2500, 5000, 10000, 15000];
const money = (c: number) => `$${(c / 100).toFixed(0)}`;

export function GiftCardPurchase({ squareConfig }: { squareConfig: SquareWebPaymentsConfig }) {
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const paymentsRef = useRef<SquarePaymentsApi | null>(null);

  const initSquare = useCallback(async () => {
    if (!getSquare() || paymentsRef.current) return;
    if (!squareConfig.applicationId || !squareConfig.locationId) return;
    try {
      const payments = getSquare()!.payments(squareConfig.applicationId, squareConfig.locationId);
      paymentsRef.current = payments;
      const card = await payments.card();
      await card.attach("#gc-card");
      cardRef.current = card;
      setSdkReady(true);
    } catch { setError("Could not load the secure card field. Refresh and try again."); }
  }, [squareConfig.applicationId, squareConfig.locationId]);

  useEffect(() => { if (getSquare()) initSquare(); }, [initSquare]);

  const effectiveAmount = custom ? Math.round(parseFloat(custom) * 100) : amount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!Number.isFinite(effectiveAmount) || effectiveAmount < 500 || effectiveAmount > 50000) { setError("Choose an amount between $5 and $500."); return; }
    if (!/.+@.+\..+/.test(buyerEmail) || !/.+@.+\..+/.test(recipientEmail)) { setError("Enter valid buyer and recipient emails."); return; }
    if (!cardRef.current) { setError("Payment field is still loading."); return; }
    setStatus("paying");
    const t = await cardRef.current.tokenize();
    if (t.status !== "OK") { setStatus("error"); setError("Please check your card details."); return; }
    try {
      const res = await fetch("/api/gift-cards/purchase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: t.token, amount: effectiveAmount, buyerEmail, recipientEmail, senderName, message }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setStatus("error"); setError(data.error || "Purchase failed."); return; }
      setStatus("done");
    } catch { setStatus("error"); setError("Connection dropped. Try again."); }
  };

  const field = "min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none";
  const labelC = "mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-muted";

  if (status === "done") {
    return <div role="status" className="border-y border-border/40 py-10"><p className="font-display text-3xl font-black uppercase">Gift sent</p><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">The gift card and code are on their way to {recipientEmail}. A receipt went to your email.</p></div>;
  }

  return (
    <>
      <Script src={squareConfig.sdkUrl} strategy="afterInteractive" onLoad={initSquare} />
      <form onSubmit={submit} className="max-w-xl border-t border-border/40 pt-8">
        <fieldset className="mb-8" disabled={status === "paying"}>
          <legend className={labelC}>Amount</legend>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => { setAmount(p); setCustom(""); }} aria-pressed={!custom && amount === p}
                className={`min-h-11 min-w-16 border px-4 text-sm font-bold ${!custom && amount === p ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"}`}>{money(p)}</button>
            ))}
            <input inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Custom" aria-label="Custom amount in dollars" className="min-h-11 w-28 border border-border/60 bg-void px-3 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none" />
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelC} htmlFor="gc-sender">Your name</label><input id="gc-sender" className={field} value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="From" /></div>
          <div><label className={labelC} htmlFor="gc-buyer">Your email (receipt)</label><input id="gc-buyer" type="email" required className={field} value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelC} htmlFor="gc-recipient">Recipient email</label><input id="gc-recipient" type="email" required className={field} value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={labelC} htmlFor="gc-msg">Message (optional)</label><textarea id="gc-msg" maxLength={300} rows={3} className={`${field} resize-none`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a note" /></div>
        </div>
        <div className="mt-6">
          <p className={labelC}>Payment</p>
          <div id="gc-card" className="min-h-[56px] border border-border/60 bg-void p-3" />
          {!sdkReady && !error && <p className="mt-2 text-xs font-bold text-muted">Loading secure card field…</p>}
        </div>
        {error && <p role="alert" className="mt-4 border border-danger bg-surface px-4 py-3 text-sm font-bold text-danger">{error}</p>}
        <button type="submit" disabled={status === "paying" || !sdkReady} className="primary-action mt-6 min-h-14 w-full px-5 py-4 text-base disabled:opacity-60">
          {status === "paying" ? "Processing…" : `Send ${money(effectiveAmount || 0)} gift card`}
        </button>
        <p className="mt-3 text-xs leading-relaxed text-muted">Secured by Square. The recipient gets the code by email; you get a receipt.</p>
      </form>
    </>
  );
}
