"use client";
import { formatDatesInText, formatDisplayDateTime } from "@/lib/dates/display";

import { unlockNotificationAudio, playNotificationSound } from "@/lib/notifications/sound";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type LiveNotification = {
  id: string;
  dedupeKey?: string;
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
    return new Set<string>(Array.isArray(parsed) ? parsed.slice(-300) : []);
  } catch {
    return new Set<string>();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-300)));
  } catch {}
}

function logicalKey(item: LiveNotification) {
  if (item.dedupeKey) return item.dedupeKey;
  if (item.eventKey === "legacy_transfer_completed" || item.title === "Aktarılan öğrenci kaydı tamamlandı") {
    return `legacy-transfer:${item.targetPath || item.body}`;
  }
  return item.id;
}

export default function LiveNotificationCenter() {
  const [current, setCurrent] = useState<LiveNotification | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const currentRef = useRef<LiveNotification | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const checkingRef = useRef(false);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const rememberHandled = useCallback((key: string) => {
    seenRef.current.add(key);
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
    if (window.location.pathname.startsWith("/odeme-belge/") || checkingRef.current || currentRef.current || document.visibilityState !== "visible") return;

    checkingRef.current = true;
    try {
      const response = await fetch("/api/notifications/live", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data.notifications)) return;

      const next = data.notifications.find(
        (item: LiveNotification) => !seenRef.current.has(logicalKey(item)),
      ) as LiveNotification | undefined;
      if (!next) return;

      currentRef.current = next;
      setExpanded(false);
      setCurrent(next);
      void playNotificationSound();

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification(formatDatesInText(next.title), {
            body: formatDatesInText(next.body),
            icon: "/icons/icon-192.png",
            tag: `sprintos-live-${logicalKey(next)}`,
          });
          n.onclick = () => {
            window.focus();
            rememberHandled(logicalKey(next));
            void markRead(next.id);
            window.location.assign(next.targetPath || "/bildirimler");
          };
        } catch {}
      }
    } catch {
    } finally {
      checkingRef.current = false;
    }
  }, [markRead, rememberHandled]);

  useEffect(() => {
    const unlock=()=>void unlockNotificationAudio();
    document.addEventListener("pointerdown",unlock);
    document.addEventListener("keydown",unlock);
    seenRef.current = readSeen();
    void check();
    const timer = window.setInterval(() => void check(), 12000);
    const onVisibility = () => void check();
    const onFocus = () => void check();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("pointerdown",unlock);
      document.removeEventListener("keydown",unlock);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  if (!current) return null;

  const tone = ["success", "warning", "error", "critical"].includes(current.severity) ? current.severity : "info";
  const label = tone === "success" ? "İşlem tamamlandı" : tone === "error" || tone === "critical" ? "Önemli bildirim" : tone === "warning" ? "Hatırlatma" : "Bilgilendirme";
  const body = formatDatesInText(current.body);

  const close = async () => {
    if (closing || navigating) return;
    setClosing(true);
    rememberHandled(logicalKey(current));
    currentRef.current = null;
    setCurrent(null);
    setClosing(false);
    void markRead(current.id);
  };

  const go = async () => {
    if (navigating || closing) return;
    setNavigating(true);
    rememberHandled(logicalKey(current));
    void markRead(current.id);
    window.location.assign(current.targetPath || "/bildirimler");
  };

  return (
    <div
      className={`liveNotificationToast ${tone}`}
      role="region"
      aria-live="polite"
      aria-labelledby={titleId}
    >
      <div className="liveNotificationHeader">
        <span className="liveNotificationIcon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4M12 2V1"/></svg>
        </span>
        <div className="liveNotificationMeta"><span>SprintOS · {label}</span><time dateTime={current.createdAt}>{formatDisplayDateTime(current.createdAt)}</time></div>
        <button type="button" className="x" aria-label="Bildirimi kapat" disabled={navigating || closing} onClick={close}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      </div>
      <div className="liveNotificationCopy">
        <strong id={titleId}>{formatDatesInText(current.title)}</strong>
        <p className={expanded || body.length <= 160 ? "expanded" : ""}>{body}</p>
        {body.length > 160 && <button type="button" className="expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Daha az göster" : "Devamını göster"}</button>}
      </div>
      <div className="liveNotificationActions">
          <button type="button" className="open" disabled={navigating || closing} onClick={go}>
            {navigating ? "İşlem açılıyor…" : <>İşlemi aç <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></>}
          </button>
          <button type="button" className="dismiss" disabled={navigating || closing} onClick={close}>
            {closing ? "Kapatılıyor…" : "Kapat"}
          </button>
      </div>
      <style jsx>{`
        .liveNotificationToast{--accent:#2563eb;--tint:#eff6ff;position:fixed;right:24px;bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:99999;width:min(400px,calc(100vw - 32px));max-height:calc(100dvh - 48px - env(safe-area-inset-bottom,0px));overflow-y:auto;padding:18px;border:1px solid #dce4ef;border-radius:20px;background:#fff;box-shadow:0 16px 48px rgba(15,35,65,.16),0 2px 8px rgba(15,35,65,.05);color:#18314e;pointer-events:auto;touch-action:manipulation;animation:notificationEnter .2s ease-out}
        .liveNotificationToast.success{--accent:#087f5b;--tint:#ecfdf5}.liveNotificationToast.warning{--accent:#a56508;--tint:#fff7e8}.liveNotificationToast.error,.liveNotificationToast.critical{--accent:#c73d45;--tint:#fff1f2}
        .liveNotificationHeader{display:flex;align-items:center;gap:10px;margin-bottom:13px}.liveNotificationIcon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:12px;background:var(--tint);color:var(--accent)}
        .liveNotificationMeta{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.liveNotificationMeta span{font-size:11px;font-weight:700;color:var(--accent);line-height:1.4}.liveNotificationMeta time{font-size:11px;color:#64748b;line-height:1.4;font-variant-numeric:tabular-nums}
        .liveNotificationCopy{min-width:0}.liveNotificationCopy strong{display:block;font-size:15px;font-weight:750;line-height:1.45;letter-spacing:-.2px;color:#142e4c;overflow-wrap:anywhere}.liveNotificationCopy p{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;margin:7px 0 0;font-size:13px;line-height:1.65;color:#52647a;overflow-wrap:anywhere;white-space:pre-line}.liveNotificationCopy p.expanded{display:block;overflow:visible}.expand{border:0;background:transparent;padding:7px 0;color:#245fa6;font-size:12px;font-weight:650;cursor:pointer;min-height:36px}
        .liveNotificationActions{display:flex;gap:8px;margin-top:16px;padding-top:13px;border-top:1px solid #edf1f6}.liveNotificationActions button{min-height:42px;padding:0 16px;border-radius:11px;font-weight:650;font-size:13px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.liveNotificationActions button:active:not(:disabled){transform:scale(.98)}.liveNotificationActions button:disabled{opacity:.65;cursor:wait}
        .open{display:flex;align-items:center;justify-content:center;gap:16px;flex:1;border:1px solid #1d58c6;background:#2563eb;color:white}.open span{font-size:17px}.dismiss{border:1px solid #dce4ee;background:#f8fafc;color:#52647a;min-width:92px}
        .x{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:#718196;cursor:pointer;padding:0;touch-action:manipulation}.x:hover,.dismiss:hover{background:#edf2f8}.x:disabled{opacity:.45}button:focus-visible{outline:3px solid #93b8fa;outline-offset:3px}
        @keyframes notificationEnter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){.liveNotificationToast{animation:none}.liveNotificationActions button:active:not(:disabled){transform:none}}
        @media(max-width:640px){.liveNotificationToast{left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));width:auto;max-height:calc(100dvh - 32px - env(safe-area-inset-bottom,0px));padding:16px;border-radius:18px}.liveNotificationActions button{min-height:44px}.x{flex-basis:44px;width:44px;height:44px}.liveNotificationHeader{gap:9px;margin-bottom:10px}}
      `}</style>
    </div>
  );
}
