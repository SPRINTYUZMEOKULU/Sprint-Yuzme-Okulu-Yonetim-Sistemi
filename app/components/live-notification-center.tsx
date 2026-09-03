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
  const seenRef = useRef<Set<string>>(new Set());
  const checkingRef = useRef(false);

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
    if (checkingRef.current || document.visibilityState !== "visible") return;
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

      seenRef.current.add(next.id);
      saveSeen(seenRef.current);
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
            window.location.href = next.targetPath || "/bildirimler";
          };
        } catch {}
      }
    } catch {
      // Sessiz tekrar deneme: oturum açılmamış sayfalarda bildirim merkezi görünmez.
    } finally {
      checkingRef.current = false;
    }
  }, []);

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

  const close = () => {
    void markRead(current.id);
    setCurrent(null);
  };

  const go = () => {
    void markRead(current.id);
    window.location.href = current.targetPath || "/bildirimler";
  };

  return (
    <div className={`liveNotificationToast ${current.severity || "info"}`} role="status" aria-live="polite">
      <div className="liveNotificationIcon" aria-hidden="true">🔔</div>
      <div className="liveNotificationCopy">
        <strong>{current.title}</strong>
        <p>{current.body}</p>
        <div className="liveNotificationActions">
          <button type="button" className="open" onClick={go}>İşleme Git</button>
          <button type="button" className="dismiss" onClick={close}>Kapat</button>
        </div>
      </div>
      <button type="button" className="x" aria-label="Bildirimi kapat" onClick={close}>×</button>
      <style jsx>{`
        .liveNotificationToast{position:fixed;right:18px;bottom:18px;z-index:2200;width:min(430px,calc(100vw - 28px));display:flex;gap:12px;padding:16px;border:1px solid #cfdbea;border-radius:18px;background:#fff;box-shadow:0 22px 60px rgba(7,31,63,.24);color:#14304d}
        .liveNotificationToast.success{border-color:#b8dfc9}.liveNotificationToast.warning{border-color:#f0d08b}.liveNotificationToast.error,.liveNotificationToast.critical{border-color:#efb7b7}
        .liveNotificationIcon{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border-radius:13px;background:#edf5ff;font-size:20px}
        .liveNotificationCopy{min-width:0;flex:1}.liveNotificationCopy strong{display:block;font-size:14px;color:#0c3159}.liveNotificationCopy p{margin:5px 0 11px;font-size:12px;line-height:1.45;color:#536a82}
        .liveNotificationActions{display:flex;gap:8px;flex-wrap:wrap}.liveNotificationActions button{min-height:34px;padding:0 12px;border-radius:10px;font-weight:800;font-size:12px;cursor:pointer}.open{border:0;background:#0b5fa5;color:white}.dismiss{border:1px solid #d4deea;background:white;color:#46627d}
        .x{border:0;background:transparent;color:#7a8da1;font-size:22px;line-height:1;cursor:pointer;padding:0 2px;align-self:flex-start}
        @media(max-width:640px){.liveNotificationToast{left:14px;right:14px;bottom:14px;width:auto}}
      `}</style>
    </div>
  );
}
