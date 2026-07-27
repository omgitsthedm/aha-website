/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "rgb(var(--c-bg) / <alpha-value>)",
        charcoal: "rgb(var(--c-charcoal) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        border: "rgb(var(--c-content) / <alpha-value>)",
        cream: "rgb(var(--c-content) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        // Accent text on a sunken/tinted panel (#F1F1F1 or darker). `accent`
        // is tuned for #FAFAFA paper and drops to 4.20:1 on #F1F1F1; this
        // clears 4.5:1 there. Use for small accent text that is not on paper.
        "accent-sunken": "rgb(var(--c-accent-on-sunken) / <alpha-value>)",
        rose: "rgb(var(--c-rose) / <alpha-value>)",
        success: "rgb(var(--c-success) / <alpha-value>)",
        warning: "rgb(var(--c-warning) / <alpha-value>)",
        danger: "rgb(var(--c-error) / <alpha-value>)",
        // `danger` is the canonical name. `error` exists because three shipped
        // components already write `text-error` / `border-error` — with no such
        // key in the theme those classes were never generated, so three live
        // customer-facing failure messages (order lookup, restock request, ops
        // login) rendered in Tailwind preflight's #e5e7eb instead of red.
        // Retire this alias once those call sites move to `danger`.
        error: "rgb(var(--c-error) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-poppins)", "Arial", "sans-serif"],
        body: ["var(--font-poppins)", "Arial", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "Menlo", "monospace"],
      },
      // Named type scale. The storefront carries 148 arbitrary `text-[…]`
      // utilities across 24 distinct values — including 20 separate clamp()
      // expressions doing roughly three heading jobs, four of them near-identical
      // hero variants that all resolve to the same 5.5rem ceiling. These tokens
      // are the collapsed set, drawn from what is already in use rather than
      // invented. Adding them renders nothing differently; migrating the call
      // sites onto them is the Tier 2 half and is tracked separately.
      fontSize: {
        // 60 uses of text-[10px] and 48 of text-[11px]. Sub-12px is a deliberate
        // choice here (mono, uppercase, tracked-out metadata), so it gets a name
        // instead of being flagged as an accident every time someone reads it.
        eyebrow: "10px",
        label: "11px",
        "display-sub": "clamp(1.5rem, 4vw, 2.5rem)",
        "display-section": "clamp(2rem, 5vw, 3.5rem)",
        "display-hero": "clamp(2.75rem, 8vw, 5.5rem)",
      },
      // 19 distinct tracking values collapse to five jobs. Negative for display
      // type, positive for uppercase mono.
      letterSpacing: {
        "display-tight": "-0.05em",
        display: "-0.03em",
        label: "0.06em",
        caps: "0.08em",
        eyebrow: "0.1em",
      },
    },
  },
  plugins: [],
};
