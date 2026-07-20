import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";
import { listReviewsByStatus, moderateReview } from "@/lib/commerce/reviews";
import { FIT_LABEL } from "@/lib/commerce/fit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review moderation", robots: { index: false, follow: false } };

type ReviewStatus = "pending" | "approved" | "rejected";

async function requireOps() {
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  if (!verifyOpsSessionToken(token)) redirect("/ops/login");
}

// Server action — cookie-guarded, so the maintenance key never touches the browser.
async function moderate(formData: FormData) {
  "use server";
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  if (!verifyOpsSessionToken(token)) redirect("/ops/login");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  const verified = formData.get("verified") === "1";
  if (id && (status === "approved" || status === "rejected")) {
    await moderateReview(id, status, status === "approved" ? verified : undefined);
    revalidatePath("/ops/reviews");
  }
}

const dateFmt = (d: Date) => {
  try { return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; }
};

export default async function OpsReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireOps();
  const sp = await searchParams;
  const status: ReviewStatus = sp.status === "approved" || sp.status === "rejected" ? sp.status : "pending";
  const rows = await listReviewsByStatus(status, 100);

  const tab = (key: ReviewStatus, label: string) => (
    <Link href={`/ops/reviews?status=${key}`} aria-current={status === key ? "page" : undefined}
      className={`min-h-11 border px-4 py-2 font-mono text-xs font-bold uppercase ${status === key ? "border-accent bg-rose text-cream" : "border-border/60 text-muted hover:border-accent hover:text-cream"}`}>
      {label}
    </Link>
  );

  const action = (id: number, next: "approved" | "rejected", label: string, verified?: boolean, primary?: boolean) => (
    <form action={moderate}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      {verified ? <input type="hidden" name="verified" value="1" /> : null}
      <button className={`min-h-11 border px-3 py-2 font-mono text-xs font-bold uppercase ${primary ? "border-accent text-accent" : "border-border/60 text-cream hover:border-accent"}`}>{label}</button>
    </form>
  );

  return <main className="px-4 pb-24 pt-28 md:px-6"><div className="mx-auto max-w-4xl">
    <header className="flex flex-wrap items-end justify-between gap-6 border-t-2 border-accent pt-5">
      <div>
        <Link href="/ops" className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-accent">&larr; Operations</Link>
        <h1 className="mt-3 font-display text-[clamp(2.5rem,7vw,4.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Reviews</h1>
      </div>
    </header>

    <nav className="mt-8 flex flex-wrap gap-2" aria-label="Review status">
      {tab("pending", "Pending")}
      {tab("approved", "Approved")}
      {tab("rejected", "Rejected")}
    </nav>

    <p className="mt-4 font-mono text-xs uppercase text-muted">{rows.length} {status} {rows.length === 1 ? "review" : "reviews"}. Only approved reviews appear on the storefront — nothing is auto-published.</p>

    {rows.length === 0 ? (
      <p className="mt-8 border-y border-border/40 py-10 text-sm text-muted">No {status} reviews.</p>
    ) : (
      <ul className="mt-8 divide-y divide-border/40">
        {rows.map((r) => (
          <li key={r.id} className="py-6">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-mono font-bold text-accent" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              <span className="font-display text-sm font-black uppercase text-cream">{r.authorName}</span>
              {r.verified && <span className="border border-success/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-success">Verified</span>}
              <span className="font-mono text-[11px] text-muted">{r.productSlug}</span>
              <span className="ml-auto font-mono text-[11px] text-muted">{dateFmt(r.createdAt)}</span>
            </div>
            {(r.sizePurchased || r.fit) && (
              <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                {r.sizePurchased && <>Bought {r.sizePurchased}</>}
                {r.sizePurchased && r.fit && <span aria-hidden="true"> · </span>}
                {r.fit && (FIT_LABEL[r.fit] ?? r.fit)}
              </p>
            )}
            {r.title && <p className="mt-2 font-display text-base font-black uppercase leading-tight text-cream">{r.title}</p>}
            <p className="mt-1 text-sm leading-relaxed text-cream/85">{r.body}</p>
            {r.email && <p className="mt-2 font-mono text-[11px] text-muted">Contact: {r.email}{r.orderNumber ? ` · order ${r.orderNumber}` : ""}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {status !== "approved" && action(r.id, "approved", "Approve", false, false)}
              {status !== "approved" && action(r.id, "approved", "Approve + verified", true, true)}
              {status !== "rejected" && action(r.id, "rejected", "Reject", false, false)}
            </div>
          </li>
        ))}
      </ul>
    )}
  </div></main>;
}
