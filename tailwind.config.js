/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // All colors read from the THEME CONTRACT channels in app/globals.css (--c-*),
        // so swapping a [data-theme] re-themes every utility. Opacity modifiers work
        // (e.g. bg-void/50) because values are rgb(<channels> / <alpha-value>).
        void: "rgb(var(--c-bg) / <alpha-value>)",
        charcoal: "rgb(var(--c-charcoal) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--c-surface) / <alpha-value>)",
          warm: "rgb(var(--c-surface-warm) / <alpha-value>)",
        },
        elevated: "rgb(var(--c-elevated) / <alpha-value>)",
        border: {
          DEFAULT: "rgb(var(--c-content) / <alpha-value>)",
          warm: "rgb(var(--c-gold) / <alpha-value>)",
        },
        cream: "rgb(var(--c-content) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        line: {
          red: "rgb(var(--c-pink) / <alpha-value>)",
          blue: "rgb(var(--c-cyan) / <alpha-value>)",
          orange: "rgb(var(--c-orange) / <alpha-value>)",
          green: "rgb(var(--c-line-green) / <alpha-value>)",
          yellow: "rgb(var(--c-lime) / <alpha-value>)",
          purple: "rgb(var(--c-line-purple) / <alpha-value>)",
          brown: "rgb(var(--c-gold) / <alpha-value>)",
          gray: "rgb(var(--c-concrete) / <alpha-value>)",
        },
        danger: "rgb(var(--c-pink) / <alpha-value>)",
        success: "rgb(var(--c-green) / <alpha-value>)",
        gold: {
          DEFAULT: "rgb(var(--c-gold) / <alpha-value>)",
          dim: "rgb(var(--c-gold) / 0.28)",
          faint: "rgb(var(--c-gold) / 0.1)",
        },
        neon: {
          green: "rgb(var(--c-green) / <alpha-value>)",
          purple: "rgb(var(--c-purple) / <alpha-value>)",
          pink: "rgb(var(--c-magenta) / <alpha-value>)",
          cyan: "rgb(var(--c-cyan) / <alpha-value>)",
          sun: "rgb(var(--c-sun) / <alpha-value>)",
          lime: "rgb(var(--c-lime) / <alpha-value>)",
        },
        navy: "rgb(var(--c-navy) / <alpha-value>)",
        mosaic: {
          gold: "rgb(var(--c-gold) / <alpha-value>)",
          brown: "rgb(var(--c-rust) / <alpha-value>)",
          dark: "rgb(var(--c-bg) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["'Arial Black'", "'Helvetica Neue'", "Arial", "sans-serif"],
        body: ["'Courier New'", "Courier", "monospace"],
        mono: ["var(--font-ibm-plex)", "'Courier New'", "Menlo", "monospace"],
      },
      fontSize: {
        hero: ["clamp(3.5rem, 10vw, 7rem)", { lineHeight: "0.9", letterSpacing: "-0.02em" }],
        chapter: ["clamp(1.75rem, 5vw, 3.5rem)", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        section: ["1.5rem", { lineHeight: "1.2" }],
        sign: ["0.8125rem", { lineHeight: "1", letterSpacing: "0.2em" }],
        label: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.15em" }],
      },
      animation: {
        "fade-up": "fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "breathe": "breathe 3s ease-in-out infinite",
        "train-slide": "trainSlide 1.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "letter-reveal": "letterReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-station": "pulseStation 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.4", transform: "translateY(0)" },
          "50%": { opacity: "0.7", transform: "translateY(-3px)" },
        },
        trainSlide: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        letterReveal: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseStation: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.3)", opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};
