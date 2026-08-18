import { ORIGIN_CLAIM_SHORT, RETURNS_WINDOW, SHIPPING_CLAIM_DETAIL, SHIPPING_CLAIM_SHORT } from "@/lib/commerce/policies";

export function TrustStrip() {
  const items = [
    { label: ORIGIN_CLAIM_SHORT, description: "One at a time, nothing wasted" },
    { label: SHIPPING_CLAIM_SHORT, description: SHIPPING_CLAIM_DETAIL },
    { label: `${RETURNS_WINDOW} returns`, description: "Return shipping on us" },
    { label: "Real people", description: "Answered by a person, always" },
  ];

  return (
    <div className="border-y border-border/10 bg-void">
      <div className="mx-auto grid max-w-[1280px] divide-y divide-border/10 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="px-4 py-5 sm:px-6 sm:py-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream">{item.label}</p>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.06em] text-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
