/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#0A0A0A",
        charcoal: "#1C1A18",
        surface: {
          DEFAULT: "#151413",
          warm: "#252320",
        },
        elevated: "#2A2826",
        border: {
          DEFAULT: "#222020",
          warm: "#3A3632",
        },
        gold: {
          DEFAULT: "#C8A961",
          dim: "rgba(200,169,97,0.25)",
          faint: "rgba(200,169,97,0.08)",
        },
        cream: "#EDE9E3",
        muted: "#7A756E",
        danger: "#EA4A4A",
        success: "#4AEA80",
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
        "grain": "grain 0.5s steps(1) infinite",
        "slide-in-right": "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "breathe": "breathe 3s ease-in-out infinite",
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
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-5%, -10%)" },
          "20%": { transform: "translate(-15%, 5%)" },
          "30%": { transform: "translate(7%, -25%)" },
          "40%": { transform: "translate(-5%, 25%)" },
          "50%": { transform: "translate(-15%, 10%)" },
          "60%": { transform: "translate(15%, 0%)" },
          "70%": { transform: "translate(0%, 15%)" },
          "80%": { transform: "translate(3%, 35%)" },
          "90%": { transform: "translate(-10%, 10%)" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.4", transform: "translateY(0)" },
          "50%": { opacity: "0.7", transform: "translateY(-3px)" },
        },
      },
    },
  },
  plugins: [],
};
