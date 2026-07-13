import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}

export function PageHeader({ eyebrow, title, description, align = "left" }: PageHeaderProps) {
  const alignment = align === "center" ? "mx-auto text-center" : "";
  return (
    <header className={`hero-copy-enter crease-rule mb-10 max-w-4xl pt-5 md:mb-14 ${alignment}`}>
      {eyebrow && <div className="mb-4 text-xs font-bold uppercase tracking-[0.08em] text-accent">{eyebrow}</div>}
      <h1 className="font-display text-[clamp(2.5rem,7vw,4rem)] font-bold leading-[0.95] tracking-[-0.04em] text-cream">{title}</h1>
      {description && <div className={`mt-5 max-w-2xl text-sm leading-relaxed text-muted md:text-base ${align === "center" ? "mx-auto" : ""}`}>{description}</div>}
    </header>
  );
}
