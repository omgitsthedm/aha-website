// The library owns Core Web Vitals session-window, interaction, and bfcache
// handling. This wrapper only samples and removes the metric when consent ends.
export function startRum({ analyticsAllowed, sampled, load = () => import("web-vitals"), report, context }) {
  if (!analyticsAllowed() || !sampled()) return false;
  void load().then((vitals) => {
    if (!analyticsAllowed()) return;
    for (const observe of [vitals.onCLS, vitals.onINP, vitals.onLCP]) {
      observe((metric) => {
        if (!analyticsAllowed()) return;
        const page = context();
        report({ metric: metric.name, value: metric.value, delta: metric.delta, id: metric.id, template: page.template, device: page.device });
      });
    }
  }).catch(() => { /* Measurement must never affect the storefront. */ });
  return true;
}
