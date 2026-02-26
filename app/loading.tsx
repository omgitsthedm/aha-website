export default function Loading() {
  return (
    <div className="pt-24 pb-16 px-6 min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-cream/20 border-t-cream rounded-full animate-spin" />
        <span className="font-body text-xs text-muted uppercase tracking-[0.2em]">
          Loading
        </span>
      </div>
    </div>
  );
}
