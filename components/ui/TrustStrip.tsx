export function TrustStrip() {
  const items = [
    { label: "Designed in NYC", description: "After hours, literally" },
    { label: "Free shipping", description: "On every order" },
    { label: "Made to order", description: "No dead stock" },
    { label: "30-day returns", description: "Hassle-free" },
  ];

  return (
    <div className="border-y border-border/40 bg-void">
      <div className="mx-auto grid max-w-[1280px] divide-y divide-border/40 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="px-4 py-5 sm:px-6 sm:py-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-cream">{item.label}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
