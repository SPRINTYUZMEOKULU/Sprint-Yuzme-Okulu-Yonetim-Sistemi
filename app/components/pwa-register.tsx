"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PushState =
  | "checking"
  | "unsupported"
  | "blocked"
  | "off"
  | "on"
  | "working"
  | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function getDeviceName() {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("macintosh")) return "Mac";
  if (ua.includes("windows")) return "Windows";

  return "SprintOS cihazı";
}

export default function PWARegister() {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("");

  const vapidPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  const supported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }, []);

  const refreshState = useCallback(async () => {
    if (!supported) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager.getSubscription();

      setState(subscription ? "on" : "off");
    } catch (error) {
      console.error("SprintOS push state:", error);
      setState("error");
    }
  }, [supported]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => refreshState())
      .catch((error) => {
        console.error("SprintOS Service Worker:", error);
        setState("error");
      });
  }, [refreshState]);

  async function enableNotifications() {
    if (!supported) {
      setState("unsupported");
      return;
    }

    if (!vapidPublicKey) {
      setMessage("VAPID public key bulunamadı.");
      setState("error");
      return;
    }

    setState("working");
    setMessage("");

    try {
      const permission = await Notification.requestPermission();

      if (permission === "denied") {
        setState("blocked");
        setMessage(
          "Bildirim izni tarayıcıdan engellendi. Tarayıcı ayarlarından SprintOS bildirimlerine izin verebilirsiniz."
        );
        return;
      }

      if (permission !== "granted") {
        setState("off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const json = subscription.toJSON();

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          },
          deviceName: getDeviceName(),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            "Cihaz bildirim kaydı oluşturulamadı."
        );
      }

      setState("on");
      setMessage(
        "Bu cihaz için SprintOS bildirimleri açıldı."
      );
    } catch (error) {
      console.error("SprintOS push enable:", error);

      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Telefon bildirimleri açılamadı."
      );
    }
  }

  async function disableNotifications() {
    if (!supported) {
      return;
    }

    setState("working");
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager.getSubscription();

      if (subscription) {
        const response = await fetch("/api/push/unsubscribe", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error ||
              "Cihaz bildirim kaydı kapatılamadı."
          );
        }

        await subscription.unsubscribe();
      }

      setState("off");
      setMessage(
        "Bu cihaz için telefon bildirimleri kapatıldı."
      );
    } catch (error) {
      console.error("SprintOS push disable:", error);

      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Telefon bildirimleri kapatılamadı."
      );
    }
  }

  if (
    state === "checking" ||
    state === "unsupported"
  ) {
    return null;
  }

  return (
    <div className="sprintPushControl">
      <div className="sprintPushInner">
        <div
          className="sprintPushIcon"
          aria-hidden="true"
        >
          🔔
        </div>

        <div className="sprintPushCopy">
          <strong>
            {state === "on"
              ? "Telefon bildirimleri açık"
              : state === "blocked"
              ? "Bildirim izni engellendi"
              : "SprintOS bildirimleri"}
          </strong>

          <span>
            {state === "on"
              ? "Bu cihaz önemli SprintOS bildirimlerini alabilir."
              : state === "blocked"
              ? "Tarayıcı ayarlarından bildirim iznini açmanız gerekiyor."
              : "Yeni ön kayıt, ödeme, kasa ve onay bildirimlerini bu cihazda alın."}
          </span>

          {message && <small>{message}</small>}
        </div>

        <div className="sprintPushActions">
          {state === "on" ? (
            <button
              type="button"
              onClick={disableNotifications}
              disabled={state === "working"}
              className="pushSecondary"
            >
              Kapat
            </button>
          ) : (
            <button
              type="button"
              onClick={enableNotifications}
              disabled={
                state === "working" ||
                state === "blocked"
              }
              className="pushPrimary"
            >
              {state === "working"
                ? "Açılıyor..."
                : "Bildirimleri Aç"}
            </button>
          )}

          <button
            type="button"
            className="pushDismiss"
            aria-label="Bildirim kutusunu kapat"
            onClick={(event) => {
              const container =
                event.currentTarget.closest(
                  ".sprintPushControl"
                );

              if (container instanceof HTMLElement) {
                container.style.display = "none";
              }
            }}
          >
            ×
          </button>
        </div>
      </div>

      <style jsx>{`
        .sprintPushControl {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 9990;
          width: min(430px, calc(100vw - 28px));
        }

        .sprintPushInner {
          display: grid;
          grid-template-columns:
            44px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 13px 14px;
          border: 1px solid
            rgba(148, 163, 184, 0.35);
          border-radius: 17px;
          background: rgba(255, 255, 255, 0.97);
          box-shadow:
            0 16px 42px rgba(15, 23, 42, 0.18);
          backdrop-filter: blur(12px);
        }

        .sprintPushIcon {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: #eaf3ff;
          font-size: 21px;
        }

        .sprintPushCopy {
          min-width: 0;
        }

        .sprintPushCopy strong {
          display: block;
          color: #173556;
          font-size: 13px;
        }

        .sprintPushCopy span {
          display: block;
          margin-top: 3px;
          color: #6b7d91;
          font-size: 11px;
          line-height: 1.45;
        }

        .sprintPushCopy small {
          display: block;
          margin-top: 5px;
          color: #0b6ef3;
          font-size: 10px;
          line-height: 1.35;
        }

        .sprintPushActions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pushPrimary,
        .pushSecondary {
          min-height: 36px;
          padding: 0 11px;
          border-radius: 10px;
          font: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }

        .pushPrimary {
          border: 0;
          background: #0b6ef3;
          color: #fff;
        }

        .pushSecondary {
          border: 1px solid #d8e1ec;
          background: #fff;
          color: #4d627a;
        }

        .pushPrimary:disabled,
        .pushSecondary:disabled {
          opacity: 0.58;
          cursor: default;
        }

        .pushDismiss {
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #94a3b8;
          font-size: 20px;
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .sprintPushControl {
            right: 10px;
            bottom: 10px;
            width: calc(100vw - 20px);
          }

          .sprintPushInner {
            grid-template-columns:
              40px minmax(0, 1fr);
          }

          .sprintPushIcon {
            width: 40px;
            height: 40px;
          }

          .sprintPushActions {
            grid-column: 1 / -1;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
