/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core — grimy subway tile white
        void: "#E8E4D8",
        charcoal: "#D8D4C8",
        surface: {
          DEFAULT: "#DDD9CE",
          warm: "#D0CCc0",
        },
        elevated: "#C8C3B6",
        border: {
          DEFAULT: "#C4BFAE",
          warm: "#B8B3A4",
        },
        // Text — near-black station ink
        cream: "#1A1917",
        muted: "#6B665E",
        // MTA Subway Line Colors
        line: {
          red: "#EE352E",
          blue: "#2850AD",
          orange: "#FF6319",
          green: "#00933C",
          yellow: "#FCCC0A",
          purple: "#B933AD",
          brown: "#996633",
          gray: "#A7A9AC",
        },
        // Utility
        danger: "#EE352E",
        success: "#00933C",
        // Legacy alias
        gold: {
          DEFAULT: "#C8A961",
          dim: "rgba(200,169,97,0.25)",
          faint: "rgba(200,169,97,0.08)",
        },
        navy: "#0C1224",
        mosaic: {
          gold: "#C8A24E",
          brown: "#7A5C2E",
          dark: "#0C1224",
        },
      },
      fontFamily: {
        // Helvetica Neue — NYCTA Graphics Standards Manual typeface
        display: ["'Helvetica Neue'", "Helvetica", "Arial", "sans-serif"],
        body: ["'Helvetica Neue'", "Helvetica", "Arial", "sans-serif"],
        // IBM Plex Mono — prices, tabular data, SplitFlap only
        mono: ["var(--font-ibm-plex)", "'SF Mono'", "Menlo", "monospace"],
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
