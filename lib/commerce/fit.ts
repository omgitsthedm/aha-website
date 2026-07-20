// Client-safe fit constants — no DB/server imports, so client components can use
// these without pulling the server-only reviews module into the browser bundle.

/** Fit codes → shopper-facing label. */
export const FIT_LABEL: Record<string, string> = {
  small: "Runs small",
  true: "True to size",
  large: "Runs large",
};
