import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/components/seo/buildMetadata";
import { SheepMark } from "@/components/ui/SheepMark";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * One intentionally non-commercial destination for every retired catalog URL.
 * Keep shoppers out of a stale product shell while retaining the route as a
 * useful release-signup and editorial entry point.
 */
export function CatalogMigrationPage() {
  return (
    <div className="px-4 pb-16 pt-28 sm:px-6 md:pt-32">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Shop update"
          title="Shop temporarily unavailable"
          description="Shopping is temporarily unavailable. For help with an existing order, contact us."
          align="center"
        />
        <section className="corner-cut crease-rule bg-charcoal px-6 py-12 text-center sm:px-10 md:py-16" aria-label="Updates">
          <SheepMark className="mx-auto mb-5 w-16 text-accent" />
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted md:text-base">
            Sign up for After Hours Agenda updates while the shop is unavailable.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/#dispatch-heading" className="btn-primary min-h-11 px-6 py-3 text-xs">Get updates</Link>
            <Link href="/contact" className="btn-secondary min-h-11 px-6 py-3 text-xs">Contact support</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Keep retired catalog URLs out of search while the store is intentionally dark. */
export function catalogMigrationMetadata(path: string): Metadata {
  return buildMetadata({
    title: "Shop temporarily unavailable",
    description: "The After Hours Agenda shop is temporarily unavailable.",
    path,
    robots: { index: false, follow: true },
  });
}
