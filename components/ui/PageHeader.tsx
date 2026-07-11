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
    <header className={`mb-10 max-w-4xl border-t-2 border-accent pt-5 md:mb-14 ${alignment}`}>
      {eyebrow && <div className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-accent">{eyebrow}</div>}
      <h1 className="font-display text-[clamp(2.75rem,8vw,7rem)] font-black uppercase leading-[0.86] tracking-[-0.06em] text-cream">{title}</h1>
      {description && <div className={`mt-5 max-w-2xl text-sm leading-relaxed text-muted md:text-base ${align === "center" ? "mx-auto" : ""}`}>{description}</div>}
    </header>
  );
}
