"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type PushState = "checking" | "unsupported" | "blocked" | "off" | "on" | "working" | "error";
const DISMISS_KEY = "sprintos_push_prompt_dismissed_v1";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
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
  const pathname = usePathname();
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(true);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const hidePromptOnThisRoute = pathname === "/login" || pathname === "/on-kayit" || pathname?.startsWith("/auth/");
  const supported = useMemo(() => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window, []);

  const saveSubscription = useCallback(async (subscription: PushSubscription) => {
    const json = subscription.toJSON();
    const response = await fetch("/api/push/subscribe", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth }, deviceName: getDeviceName() }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Cihaz bildirim kaydı oluşturulamadı.");
  }, []);

  const refreshState = useCallback(async () => {
    if (hidePromptOnThisRoute) return;
    if (!supported) { setState("unsupported"); return; }
    if (window.localStorage.getItem("sprintos_push_disabled_v1") === "1") { setState("off"); return; }
    if (Notification.permission === "denied") { setState("blocked"); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription && Notification.permission === "granted" && vapidPublicKey && window.localStorage.getItem("sprintos_push_disabled_v1") !== "1") {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      }
      // Kritik düzeltme: tarayıcıda abonelik zaten mevcut olsa bile sunucudaki
      // kayıt pasif/eski kalmış olabilir. Her oturumda tekrar upsert ederek cihazı
      // SprintOS push havuzuyla eşitliyoruz.
      if (subscription && Notification.permission === "granted") await saveSubscription(subscription);
      setState(subscription && Notification.permission === "granted" ? "on" : "off");
    } catch (error) {
      console.error("SprintOS push state:", error); setState("error");
    }
  }, [supported, vapidPublicKey, saveSubscription, hidePromptOnThisRoute]);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    if (!("serviceWorker" in navigator)) { setState("unsupported"); return; }
    navigator.serviceWorker.register("/sw.js").then(() => refreshState()).catch((error) => { console.error("SprintOS Service Worker:", error); setState("error"); });
  }, [refreshState]);

  // iOS/PWA uygulaması uzun süre açık kaldığında veya arka plandan döndüğünde
  // abonelik sunucu tarafında pasifleşmiş olabilir. Uygulama yeniden görünür
  // olduğunda sessizce doğrula ve tekrar etkinleştir.
  useEffect(() => {
    if (!supported) return;
    const resync = () => { if (document.visibilityState === "visible" && Notification.permission === "granted") void refreshState(); };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("sprintos:push-changed", resync);
    return () => { document.removeEventListener("visibilitychange", resync); window.removeEventListener("focus", resync); window.removeEventListener("sprintos:push-changed", resync); };
  }, [supported, refreshState]);

  async function enableNotifications() {
    if (!supported) return;
    if (!vapidPublicKey) { setMessage("VAPID public key bulunamadı."); setState("error"); return; }
    setState("working"); setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") { setState("blocked"); setMessage("Bildirim izni tarayıcıdan engellendi. Ayarlar > Bildirimler bölümünden tekrar kontrol edebilirsiniz."); return; }
      if (permission !== "granted") { setState("off"); return; }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      await saveSubscription(subscription);
      window.localStorage.removeItem("sprintos_push_disabled_v1");
      window.localStorage.removeItem(DISMISS_KEY); setDismissed(false); setState("on");
    } catch (error) {
      console.error("SprintOS push enable:", error); setState("error"); setMessage(error instanceof Error ? error.message : "Telefon bildirimleri açılamadı.");
    }
  }

  if (hidePromptOnThisRoute || state === "checking" || state === "unsupported" || state === "on" || dismissed) return null;
  return <div className="sprintPushControl"><div className="sprintPushInner"><div className="sprintPushIcon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></div><div className="sprintPushCopy"><strong>{state === "blocked" ? "Bildirim izni engellendi" : "SprintOS bildirimleri kapalı"}</strong><span>{state === "blocked" ? "Tarayıcı ayarlarından izin verip Ayarlar > Bildirimler bölümünden tekrar açabilirsiniz." : "Yeni ön kayıt, ödeme, kasa ve onay bildirimlerini bu cihazda almak için açın."}</span>{message && <small>{message}</small>}</div><div className="sprintPushActions"><button type="button" onClick={enableNotifications} disabled={state === "working" || state === "blocked"} className="pushPrimary">{state === "working" ? "Açılıyor..." : "Bildirimleri Aç"}</button><button type="button" className="pushDismiss" aria-label="Bildirim hatırlatmasını kapat" onClick={() => { window.localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}>×</button></div></div><style jsx>{`.sprintPushControl{position:fixed;right:18px;bottom:18px;z-index:9990;width:min(430px,calc(100vw - 28px))}.sprintPushInner{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 14px;border:1px solid rgba(148,163,184,.35);border-radius:17px;background:rgba(255,255,255,.97);box-shadow:0 16px 42px rgba(15,23,42,.18);backdrop-filter:blur(12px)}.sprintPushIcon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#eaf3ff;font-size:21px}.sprintPushCopy{min-width:0}.sprintPushCopy strong{display:block;color:#173556;font-size:13px}.sprintPushCopy span{display:block;margin-top:3px;color:#6b7d91;font-size:11px;line-height:1.45}.sprintPushCopy small{display:block;margin-top:5px;color:#0b6ef3;font-size:10px;line-height:1.35}.sprintPushActions{display:flex;align-items:center;gap:6px}.pushPrimary{min-height:36px;padding:0 11px;border:0;border-radius:10px;background:#0b6ef3;color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}.pushPrimary:disabled{opacity:.58;cursor:default}.pushDismiss{width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:#94a3b8;font-size:20px;cursor:pointer}@media(max-width:640px){.sprintPushControl{right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));width:calc(100vw - 20px)}.sprintPushInner{grid-template-columns:40px minmax(0,1fr)}.sprintPushIcon{width:40px;height:40px}.sprintPushActions{grid-column:1/-1;justify-content:flex-end}}`}</style></div>;
}
