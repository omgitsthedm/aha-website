export default function Loading() {
  return (
    <div className="px-4 pb-24 pt-28 md:px-6 md:pt-32" role="status" aria-label="Loading page">
      <div className="mx-auto max-w-7xl">
        <div className="crease-rule pt-6">
          <div className="h-3 w-36 animate-pulse bg-charcoal" />
          <div className="mt-4 h-12 w-2/3 max-w-lg animate-pulse bg-charcoal" />
          <div className="mt-4 h-4 w-full max-w-md animate-pulse bg-charcoal" />
        </div>
        <div className="mt-12 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-5">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={index > 1 ? "hidden md:block" : undefined}>
              <div className="fold-surface aspect-[3/4] animate-pulse" />
              <div className="mt-3 h-4 w-3/4 animate-pulse bg-charcoal" />
              <div className="mt-2 h-3 w-1/3 animate-pulse bg-charcoal" />
            </div>
          ))}
        </div>
        <p className="sr-only">Loading page</p>
      </div>
    </div>
  );
}
