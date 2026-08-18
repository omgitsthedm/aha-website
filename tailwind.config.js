/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  future: {
    // Emit `hover:` and `group-hover:` variants inside
    // `@media (hover: hover) and (pointer: fine)`. Without it, a tap on a touch
    // screen latches the hover state until the next tap elsewhere — so a shopper
    // who taps a product card leaves it stuck in its hovered treatment with the
    // second grid image swapped in.
    //
    // Known trade: Tailwind gates on `pointer: fine` as well as `hover`, and
    // iPadOS reports a coarse primary pointer even with a trackpad attached, so
    // that setup loses hover styling. Accepted, because nothing on this site is
    // hover-only in function — every hover rule here is a colour shift, a lift or
    // the grid crossfade, and each has a visible resting state. Mouse and
    // trackpad laptops, including hybrids with touch screens, are unaffected.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        // ── Inherited inverted names — read before you trust one ─────────────
        // `void` is the PAPER ground (#FAFAFA) and `cream` is the INK (#1A1A1A).
        // Both names date from the retired ink-black era and are exactly
        // backwards for the light system that actually shipped.
        //
        // They are deliberately NOT being renamed. It is roughly 484 call sites
        // on a live storefront for a change no pixel would record — regression
        // surface bought with nothing. The semantic ROLE survived the palette
        // flip intact: `text-cream` on `bg-void` is ink on paper at ~15.9:1, so
        // a contributor gets a surprising name and a correct result. Read `void`
        // as "page ground" and `cream` as "type colour". Revisit only if a
        // refactor of these same files is already planned for another reason.
        void: "rgb(var(--c-bg) / <alpha-value>)",
        charcoal: "rgb(var(--c-charcoal) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        // Split off --c-content: a rule and a paragraph of body copy are the
        // same ink today, but they are not the same decision. Same value, so
        // the split renders nothing differently.
        border: "rgb(var(--c-border) / <alpha-value>)",
        // The visible edge of a control that has no fill of its own (#8A8A8A,
        // 3.31:1 on paper). This is what `border-border/40` is standing in for
        // at call sites today — ink at 40% alpha, a different colour for the
        // same job, and one that does not clear WCAG 1.4.11 where the border is
        // the button's only identification. Migrate those to `border-control`.
        control: "rgb(var(--c-control-border) / <alpha-value>)",
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
        editorial: ["var(--font-editorial)", "Georgia", "serif"],
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
      // Motion. The tokens live in `:root` in globals.css; hand-written CSS has
      // always used them, but every Tailwind `transition-*` utility on the site
      // was running on the framework's own curve and duration, so the two halves
      // of the system did not agree.
      //
      // Wiring DEFAULT fixes that for utilities that name no duration or easing.
      // It is not a perceptual change: 140ms against the framework's 150ms is
      // below the threshold anyone can see. What it buys is that a bare
      // `transition-colors` now decelerates on the brand curve, and that the
      // reduced-motion block — which zeroes these same tokens — reaches it.
      // Call sites that already write `duration-300` or `ease-out` still win.
      transitionDuration: {
        DEFAULT: "var(--aha-motion-fast)",
        fast: "var(--aha-motion-fast)",
        base: "var(--aha-motion-base)",
        slow: "var(--aha-motion-slow)",
        // Exits run shorter than entrances by design — see the token comment.
        exit: "var(--aha-motion-exit)",
      },
      transitionTimingFunction: {
        DEFAULT: "var(--aha-ease-out)",
        // Named so a call site can reach for the brand curves on purpose. The
        // framework's ease-in / ease-out / ease-in-out keys are left alone:
        // someone writing `ease-out` means the standard curve, and silently
        // redefining it under them would be a trap.
        brand: "var(--aha-ease-out)",
        "brand-in": "var(--aha-ease-in)",
      },
    },
  },
  plugins: [],
};
