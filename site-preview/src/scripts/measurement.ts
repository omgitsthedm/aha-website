const storageKey = "aha:measurement:v1";
const optedOut = () =>
  navigator.doNotTrack === "1" ||
  (navigator as Navigator & { globalPrivacyControl?: boolean })
    .globalPrivacyControl === true;
let choice = "off";
try {
  choice = localStorage.getItem(storageKey) || "off";
} catch {
  /* Measurement stays off when storage is unavailable. */
}
let activated = false;
function allowed() {
  return (
    choice === "allow" &&
    !optedOut() &&
    document.documentElement.dataset.mode === "production"
  );
}
async function send(event: string, value?: number) {
  if (!allowed()) return;
  try {
    await fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        value,
        path: location.pathname,
        device: innerWidth < 768 ? "mobile" : "desktop",
        consent: true,
      }),
      keepalive: true,
    });
  } catch {
    /* Measurement never interrupts shopping. */
  }
}
async function activate() {
  if (activated || !allowed()) return;
  activated = true;
  void send("page_view");
  const { onLCP, onINP, onCLS } = await import("web-vitals");
  onLCP((metric) => void send("LCP", metric.value));
  onINP((metric) => void send("INP", metric.value));
  onCLS((metric) => void send("CLS", metric.value));
}
function render() {
  document
    .querySelectorAll<HTMLElement>("[data-privacy-status]")
    .forEach(
      (el) =>
        (el.textContent = optedOut()
          ? "Your browser privacy preference keeps measurement off."
          : choice === "allow"
            ? "Optional measurement is allowed. No advertising trackers are used."
            : "Optional measurement is off."),
    );
}
document
  .querySelectorAll<HTMLButtonElement>("[data-privacy]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      choice =
        button.dataset.privacy === "allow" && !optedOut() ? "allow" : "off";
      try {
        localStorage.setItem(storageKey, choice);
      } catch {
        choice = "off";
      }
      render();
      void activate();
    }),
  );
document.addEventListener("aha:conversion", (event) => {
  const name = (event as CustomEvent).detail;
  if (
    [
      "newsletter_signup",
      "support_request",
      "add_to_bag",
      "begin_checkout",
    ].includes(name)
  )
    void send(name);
});
window.addEventListener("storage", (event) => {
  if (event.key === storageKey) {
    choice = event.newValue || "off";
    render();
    void activate();
  }
});
render();
void activate();
