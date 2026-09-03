"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LiveNotification = {
  id: string;
  title: string;
  body: string;
  severity: string;
  priority: string;
  eventKey: string | null;
  targetPath: string;
  createdAt: string;
};

const SEEN_KEY = "sprintos-live-notification-seen";

function readSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return new Set<string>(Array.isArray(parsed) ? parsed.slice(-100) : []);
  } catch {
    return new Set<string>();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-100)));
  } catch {}
}

export default function LiveNotificationCenter() {
  const [current, setCurrent] = useState<LiveNotification | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [closing, setClosing] = useState(false);
  const currentRef = useRef<LiveNotification | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const checkingRef = useRef(false);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const rememberHandled = useCallback((id: string) => {
    seenRef.current.add(id);
    saveSeen(seenRef.current);
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch("/api/notifications/live", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
  }, []);

  const check = useCallback(async () => {
    if (
      checkingRef.current ||
      currentRef.current ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    checkingRef.current = true;
    try {
      const response = await fetch("/api/notifications/live", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data.notifications)) return;

      const next = data.notifications.find(
        (item: LiveNotification) => !seenRef.current.has(item.id),
      ) as LiveNotification | undefined;
      if (!next) return;

      // Önemli: Bildirim burada okunmuş/görülmüş sayılmaz.
      // Kullanıcı Kapat veya İşleme Git seçeneğine basana kadar ekranda kalır.
      currentRef.current = next;
      setCurrent(next);

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification(next.title, {
            body: next.body,
            icon: "/icons/icon-192.png",
            tag: `sprintos-live-${next.id}`,
          });
          n.onclick = () => {
            window.focus();
            rememberHandled(next.id);
            void markRead(next.id);
            window.location.assign(next.targetPath || "/bildirimler");
          };
        } catch {}
      }
    } catch {
      // Oturum açılmamış sayfalarda sessizce tekrar denenir.
    } finally {
      checkingRef.current = false;
    }
  }, [markRead, rememberHandled]);

  useEffect(() => {
    seenRef.current = readSeen();
    void check();
    const timer = window.setInterval(() => void check(), 12000);
    const onVisibility = () => void check();
    const onFocus = () => void check();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  if (!current) return null;

  const close = async () => {
    if (closing || navigating) return;
    setClosing(true);
    rememberHandled(current.id);
    await markRead(current.id);
    currentRef.current = null;
    setCurrent(null);
    setClosing(false);
    window.setTimeout(() => void check(), 100);
  };

  const go = async () => {
    if (navigating || closing) return;
    setNavigating(true);
    rememberHandled(current.id);
    await markRead(current.id);
    window.location.assign(current.targetPath || "/bildirimler");
  };

  return (
    <div
      className={`liveNotificationToast ${current.severity || "info"}`}
      role="alertdialog"
      aria-live="assertive"
      aria-label="SprintOS işlem bildirimi"
    >
      <div className="liveNotificationIcon" aria-hidden="true">🔔</div>
      <div className="liveNotificationCopy">
        <strong>{current.title}</strong>
        <p>{current.body}</p>
        <div className="liveNotificationActions">
          <button
            type="button"
            className="open"
            disabled={navigating || closing}
            onClick={go}
          >
            {navigating ? "İşleme gidiliyor…" : "İşleme Git"}
          </button>
          <button
            type="button"
            className="dismiss"
            disabled={navigating || closing}
            onClick={close}
          >
            {closing ? "Kapatılıyor…" : "Kapat"}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="x"
        aria-label="Bildirimi kapat"
        disabled={navigating || closing}
        onClick={close}
      >×</button>
      <style jsx>{`
        .liveNotificationToast{position:fixed;right:18px;bottom:18px;z-index:99999;width:min(430px,calc(100vw - 28px));display:flex;gap:12px;padding:16px;border:1px solid #cfdbea;border-radius:18px;background:#fff;box-shadow:0 22px 60px rgba(7,31,63,.24);color:#14304d;pointer-events:auto;touch-action:manipulation}
        .liveNotificationToast.success{border-color:#b8dfc9}.liveNotificationToast.warning{border-color:#f0d08b}.liveNotificationToast.error,.liveNotificationToast.critical{border-color:#efb7b7}
        .liveNotificationIcon{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border-radius:13px;background:#edf5ff;font-size:20px;pointer-events:none}
        .liveNotificationCopy{min-width:0;flex:1}.liveNotificationCopy strong{display:block;font-size:14px;color:#0c3159}.liveNotificationCopy p{margin:5px 0 11px;font-size:12px;line-height:1.45;color:#536a82}
        .liveNotificationActions{display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:2}.liveNotificationActions button{min-height:44px;padding:0 14px;border-radius:11px;font-weight:850;font-size:13px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;pointer-events:auto}.liveNotificationActions button:active:not(:disabled){transform:scale(.97)}.liveNotificationActions button:disabled{opacity:.7;cursor:wait}
        .open{border:0;background:#0b5fa5;color:white;min-width:128px}.dismiss{border:1px solid #d4deea;background:white;color:#46627d;min-width:80px}
        .x{position:relative;z-index:2;min-width:40px;min-height:40px;border:0;background:transparent;color:#7a8da1;font-size:22px;line-height:1;cursor:pointer;padding:0 2px;align-self:flex-start;touch-action:manipulation;pointer-events:auto}.x:disabled{opacity:.45}
        @media(max-width:640px){.liveNotificationToast{left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));width:auto;padding:14px}.liveNotificationActions{display:grid;grid-template-columns:1fr 1fr}.liveNotificationActions button{width:100%;min-height:48px}.x{min-width:44px;min-height:44px}}
      `}</style>
    </div>
  );
}
