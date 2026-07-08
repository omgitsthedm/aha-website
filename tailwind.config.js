/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core - blacklight zine storefront
        void: "#10100F",
        charcoal: "#181816",
        surface: {
          DEFAULT: "#20201C",
          warm: "#2A241E",
        },
        elevated: "#2F2E28",
        border: {
          DEFAULT: "#E9E1D4",
          warm: "#B5A642",
        },
        // Text
        cream: "#E9E1D4",
        muted: "#A9A093",
        // Bright block colors
        line: {
          red: "#FF006E",
          blue: "#00FFFF",
          orange: "#FF7F00",
          green: "#00933C",
          yellow: "#CCFF00",
          purple: "#B933AD",
          brown: "#B5A642",
          gray: "#7A7A7A",
        },
        // Utility
        danger: "#FF006E",
        success: "#39FF14",
        // Legacy alias
        gold: {
          DEFAULT: "#B5A642",
          dim: "rgba(181,166,66,0.28)",
          faint: "rgba(181,166,66,0.1)",
        },
        neon: {
          green: "#39FF14",
          purple: "#BF00FF",
          pink: "#FF1493",
          cyan: "#00FFFF",
          sun: "#FFAA00",
          lime: "#CCFF00",
        },
        navy: "#15110F",
        mosaic: {
          gold: "#B5A642",
          brown: "#8C2727",
          dark: "#10100F",
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
