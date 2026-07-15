import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { orders } from "@/db/schema";
import { verifySession, ACCOUNT_COOKIE } from "@/lib/account/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccountSignIn } from "@/components/account/AccountSignIn";

export const metadata: Metadata = {
  title: "Your Account",
  description: "Sign in to see your After Hours Agenda order history.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

const money = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const email = verifySession((await cookies()).get(ACCOUNT_COOKIE)?.value);

  if (!email) {
    return (
      <main className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Account" title="Sign in" description="See your order history and reorder in a tap. Passwordless — we email you a one-time link." />
        <AccountSignIn linkError={error === "link"} />
      </div></main>
    );
  }

  const rows = isDbConfigured()
    ? await db().select().from(orders).where(eq(orders.email, email)).orderBy(desc(orders.createdAt)).limit(50).catch(() => [])
    : [];

  return (
    <main className="px-4 pb-24 pt-28 md:px-6 md:pt-32"><div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Account" title="Your orders" description={`Signed in as ${email}.`} />
      <form action="/api/account/logout" method="POST" className="mb-8">
        <button type="submit" className="min-h-11 border border-border/60 px-4 py-2 text-xs font-bold uppercase tracking-wide hover:border-accent hover:text-accent">Sign out</button>
      </form>

      {rows.length === 0 ? (
        <div className="border-y border-border/40 py-8">
          <p className="text-sm text-muted">No orders yet under this email.</p>
          <Link href="/shop" className="primary-action mt-4 inline-flex min-h-11 items-center px-5 py-3 text-xs">Start shopping</Link>
        </div>
      ) : (
        <ul className="border-t border-border/40">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 py-5">
              <div>
                <p className="font-display text-lg font-black uppercase leading-tight">{o.externalOrderNumber}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{fmtDate(o.createdAt)} · {o.customerStatus}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-bold">{money(o.totalAmount, o.currency)}</span>
                <Link href={`/track-order?order=${encodeURIComponent(o.externalOrderNumber)}`} className="min-h-11 py-3 text-xs font-bold uppercase text-accent underline underline-offset-4">Track</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div></main>
  );
}
