// AHA service worker — deliberately minimal for a commerce site.
// It NEVER caches product, price, or cart data (stale prices are dishonest).
// It provides exactly one thing: a branded offline fallback for navigations.
const VERSION = "aha-sw-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only intercept top-level navigations; every asset/API request passes through.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.open(VERSION).then((cache) => cache.match(OFFLINE_URL))
    )
  );
});

// Web push scaffolding: shows functional notifications when the backend sends
// them (restock / order shipped). No subscription happens without user opt-in.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: "After Hours Agenda", body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title || "After Hours Agenda", {
      body: payload.body || "",
      icon: "/brand/icons/icon-192.png",
      badge: "/brand/icons/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
