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

  const title = payload.title || "SprintOS";

  const options = {
    body:
      payload.body ||
      payload.message ||
      "Yeni bir bildiriminiz var.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag:
      payload.tag ||
      payload.notificationId ||
      `sprintos-${Date.now()}`,
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

  const targetUrl = new URL(
    targetPath,
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            try {
              if ("navigate" in client) {
                await client.navigate(targetUrl);
              }

              return client.focus();
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
