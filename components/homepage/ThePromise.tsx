import { WhiteBand } from "@/components/ui/WhiteBand";

export function ThePromise() {
  return (
    <section className="py-6 px-6 bg-void">
      <WhiteBand />
      <p className="font-mono text-xs text-muted tracking-[0.1em] text-center py-6">
        FREE SHIPPING $75+ &nbsp;&middot;&nbsp; 30-DAY RETURNS &nbsp;&middot;&nbsp; TRACKED DELIVERY
      </p>
      <WhiteBand />
    </section>
  );
}
