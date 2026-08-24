import LifiCredit from "@/components/ui/LifiCredit";

/**
 * The site-wide Little Fight NYC credit: one quiet line closing every page.
 * Replaces the old full-width care bar (and the two webfonts it pulled in).
 */
export function LittleFightCareBar() {
  return (
    <div className="lf-credit-strip no-print">
      <LifiCredit size="11px" />
    </div>
  );
}
