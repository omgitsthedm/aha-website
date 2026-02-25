/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core — subway tunnel darkness
        void: "#141414",
        charcoal: "#1C1A18",
        surface: {
          DEFAULT: "#1A1918",
          warm: "#252320",
        },
        elevated: "#2A2826",
        border: {
          DEFAULT: "#2A2725",
          warm: "#3A3632",
        },
        // Text — aged porcelain (not pure white)
        cream: "#E8E4DE",
        muted: "#7A756E",
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
      },
      fontFamily: {
        display: ["var(--font-inter)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-ibm-plex)", "monospace"],
      },
      fontSize: {
        hero: ["clamp(4rem, 12vw, 9rem)", { lineHeight: "0.9", letterSpacing: "-0.03em" }],
        chapter: ["clamp(2rem, 6vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        section: ["1.875rem", { lineHeight: "1.2" }],
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
