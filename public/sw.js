const CACHE_NAME = "sprintos-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // SprintOS şu anda network-first çalışacak.
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      body: event.data
        ? event.data.text()
        : "Yeni bir SprintOS bildiriminiz var.",
    };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = {};

  const title = payload.title || "SprintOS";

  const options = {
    body:
      payload.body ||
      payload.message ||
      "Yeni bir bildiriminiz var.",
    icon: payload.icon || "/icons/icon-192.png?v=7",
    badge: payload.badge || "/icons/icon-192.png?v=7",
    tag:
      payload.tag ||
      payload.notificationId ||
      `sprintos-${Date.now()}`,
    silent: false,
    vibrate: [250, 120, 250, 120, 400],
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: {
      targetPath:
        payload.targetPath ||
        payload.target_path ||
        "/bildirimler",
      notificationId:
        payload.notificationId ||
        payload.notification_id ||
        null,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath =
    event.notification?.data?.targetPath ||
    "/bildirimler";

  let targetUrl = new URL("/bildirimler", self.location.origin).href;
  try {
    const candidate = new URL(targetPath, self.location.origin);
    if (candidate.origin === self.location.origin && /^https?:$/.test(candidate.protocol)) {
      targetUrl = candidate.href;
    }
  } catch {
    // Eski veya hatalı bir bildirim de bildirim merkezini açabilsin.
  }

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client && new URL(client.url).origin === self.location.origin) {
            try {
              if ("navigate" in client) {
                const navigated = await client.navigate(targetUrl);
                if (!navigated) continue;
                return navigated.focus();
              }

              if (client.url === targetUrl) return client.focus();
            } catch {
              // Diğer açık pencereyi dene.
            }
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      })
  );
});
