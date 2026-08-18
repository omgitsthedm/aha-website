import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}

/**
 * Every page opens the same way: a quiet mono eyebrow, the title in the
 * editorial serif, one paragraph. No rule, no crease, no accent colour — the
 * page's own imagery is allowed to be the only loud thing.
 */
export function PageHeader({ eyebrow, title, description, align = "left" }: PageHeaderProps) {
  const alignment = align === "center" ? "mx-auto text-center" : "";
  return (
    <header className={`hero-copy-enter mb-10 max-w-4xl pt-5 md:mb-14 ${alignment}`}>
      {eyebrow && <div className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted">{eyebrow}</div>}
      <h1 className="editorial-title text-[clamp(2.5rem,6vw,4.75rem)] text-cream">{title}</h1>
      {description && <div className={`mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-lg ${align === "center" ? "mx-auto" : ""}`}>{description}</div>}
    </header>
  );
}
