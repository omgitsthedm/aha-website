import { SheepMark } from "@/components/ui/SheepMark";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 pt-24" role="status">
      <div className="w-full max-w-md text-center">
        <SheepMark className="mx-auto w-20 animate-pulse text-cream" />
        <div className="mt-5 h-1 w-full overflow-hidden bg-surface">
          <div className="h-full w-1/3 animate-pulse bg-accent" />
        </div>
        {/* Keeps the literal word "Loading" for the role="status" announcement —
            the brand voice rides along, it does not replace the status. */}
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-muted">Loading — the sheep knows the way</p>
      </div>
    </div>
  );
}
