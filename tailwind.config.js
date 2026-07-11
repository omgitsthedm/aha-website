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
        success: "rgb(var(--c-success) / <alpha-value>)",
        warning: "rgb(var(--c-warning) / <alpha-value>)",
        danger: "rgb(var(--c-error) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Arial Black'", "'Helvetica Neue'", "Arial", "sans-serif"],
        body: ["var(--font-ibm-plex)", "'Courier New'", "Menlo", "monospace"],
        mono: ["var(--font-ibm-plex)", "'Courier New'", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
