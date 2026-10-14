"use client";

import { NOTIFICATION_TONES, getNotificationTone, setNotificationTone, getNotificationVolume, setNotificationVolume, type NotificationTone, notificationSoundEnabled, setNotificationSoundEnabled, unlockNotificationAudio, playNotificationSound } from "@/lib/notifications/sound";
import { useEffect, useMemo, useState } from "react";

type PushState = "checking" | "unsupported" | "blocked" | "off" | "on" | "working" | "error";

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

export default function NotificationSettingsClient() {
  const [longSound,setLongSound]=useState(true);
  const [tone,setTone]=useState<NotificationTone>('soft-bell');
  const [volume,setVolume]=useState(.65);
  useEffect(()=>{setLongSound(notificationSoundEnabled());setTone(getNotificationTone());setVolume(getNotificationVolume())},[]);
  async function preview(id:NotificationTone){if(await unlockNotificationAudio()){await playNotificationSound(true,id);setMessage(`${NOTIFICATION_TONES.find(t=>t.id===id)?.name} önizlemesi çalınıyor.`)}else setMessage("Ses başlatılamadı. Cihazın ses ayarlarını kontrol edin.")}

  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("");
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }, []);

  async function refreshState() {
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
      const subscription = await registration.pushManager.getSubscription();
      if(subscription){
        const json=subscription.toJSON();
        const response=await fetch("/api/push/subscribe",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:subscription.endpoint,keys:{p256dh:json.keys?.p256dh,auth:json.keys?.auth},deviceName:getDeviceName()})});
        if(!response.ok)throw new Error("Cihazın sunucu bildirim kaydı yenilenemedi.");
      }
      setState(subscription ? "on" : "off");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").then(refreshState).catch(() => setState("error"));
  }, []);

  async function enableNotifications() {
    if (!supported || !vapidPublicKey) {
      setState("error");
      setMessage(!vapidPublicKey ? "VAPID public key bulunamadı." : "Bu cihaz bildirimleri desteklemiyor.");
      return;
    }

    setState("working");
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        setMessage("Bildirim izni cihaz/tarayıcı ayarlarından engellenmiş. Önce oradan izin verin.");
        return;
      }
      if (permission !== "granted") {
        setState("off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const json = subscription.toJSON();
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          deviceName: getDeviceName(),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Bildirim kaydı açılamadı.");

      window.localStorage.removeItem("sprintos_push_prompt_dismissed_v1");
      setState("on");
      setMessage("Telefon bildirimleri bu cihaz için açık. Yeni ön kayıt, ödeme, kasa ve onay bildirimleri alınacak.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Telefon bildirimleri açılamadı.");
    }
  }

  async function disableNotifications() {
    if (!supported) return;
    setState("working");
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/unsubscribe", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Bildirim kaydı kapatılamadı.");
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Telefon bildirimleri bu cihaz için kapatıldı. İstediğiniz zaman buradan tekrar açabilirsiniz.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Telefon bildirimleri kapatılamadı.");
    }
  }

  const isOn = state === "on";
  const isWorking = state === "working";

  return (
    <section className="notificationSettingsCard">
      <div className="notificationStatusIcon">🔔</div>
      <div className="notificationSettingsCopy">
        <div className="notificationTonePicker">
          <h3>Bildirim sesini seçin</h3><p>Önce dinleyin, ardından beğendiğiniz sesi seçin. Seçiminiz bu cihazda saklanır.</p>
          <div className="notificationToneGrid" role="radiogroup" aria-label="Bildirim sesi">
            {NOTIFICATION_TONES.map(option=><div className={tone===option.id?"toneCard selected":"toneCard"} key={option.id}>
              <label><input type="radio" name="notification-tone" value={option.id} checked={tone===option.id} onChange={()=>{setTone(option.id);setNotificationTone(option.id);setMessage(`${option.name} seçildi.`)}}/><strong>{option.name}</strong></label>
              <span>{option.description}</span><small>{option.duration}{tone===option.id?" · Seçili":""}</small>
              <button type="button" onClick={()=>void preview(option.id)} aria-label={`${option.name} sesini dinle`}>▶ Dinle</button>
            </div>)}
          </div>
          <label className="toneVolume">Uygulama içi ses düzeyi · %{Math.round(volume*100)}<input type="range" min="25" max="100" step="5" value={Math.round(volume*100)} onChange={event=>{const value=Number(event.target.value)/100;setVolume(value);setNotificationVolume(value)}}/></label>
          <div className="notificationActions">
            <button type="button" className="notificationSecondary" aria-pressed={longSound} onClick={()=>{const enabled=!longSound;setLongSound(enabled);setNotificationSoundEnabled(enabled);void unlockNotificationAudio()}}>{longSound?"Uygulama içi ses açık":"Uygulama içi ses kapalı"}</button>
            <button type="button" className="notificationSecondary" onClick={()=>void preview(tone)}>Seçili sesi test et</button>
          </div>
        </div>
        <p>Uzun ses uygulama açıkken çalışır. iPhone’da uygulama kapalıyken bildirim sesi ve Odak/sessiz ayarları iOS tarafından yönetilir. Ana ekrana eklenen SprintOS için bildirim izni açık olmalıdır.</p>
        <div className="notificationTitleRow">
          <div>
            <span>BU CİHAZ</span>
            <h2>Telefon Bildirimleri</h2>
          </div>
          <b className={`notificationBadge ${isOn ? "on" : "off"}`}>
            {state === "checking" || isWorking ? "Kontrol ediliyor" : isOn ? "Açık" : state === "blocked" ? "Engellendi" : "Kapalı"}
          </b>
        </div>

        <p>
          Normal kullanımda bildirimleri açık tutmanızı öneririz. Yeni ön kayıt, ödeme, kasa, onay ve önemli SprintOS olayları bu cihazda bildirim olarak gösterilir.
        </p>

        {state === "blocked" ? (
          <div className="notificationWarning">Bu cihazda bildirim izni tarayıcı/telefon ayarlarından engellenmiş. Önce cihaz ayarlarından SprintOS bildirimlerine izin verin.</div>
        ) : null}

        {message ? <div className="notificationMessage">{message}</div> : null}

        <div className="notificationActions">
          {isOn ? (
            <button type="button" className="notificationDanger" onClick={disableNotifications}>Bildirimleri Kapat</button>
          ) : (
            <button type="button" className="notificationPrimary" onClick={enableNotifications} disabled={isWorking || state === "blocked" || state === "unsupported"}>Bildirimleri Aç</button>
          )}
          <button type="button" className="notificationSecondary" onClick={refreshState} disabled={isWorking}>Durumu Yenile</button>
        </div>
      </div>

      <style jsx>{`
        .notificationTonePicker{padding:16px;border:1px solid #dbe5f1;border-radius:16px;background:#f8fbff;margin-bottom:18px}.notificationTonePicker h3{margin:0;font-size:18px;color:#14213d}.notificationToneGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:14px}.toneCard{padding:13px;border:1px solid #d8e1ed;border-radius:12px;background:#fff;display:grid;gap:7px}.toneCard.selected{border-color:#176de9;box-shadow:0 0 0 1px #176de9}.toneCard label{display:flex;align-items:center;gap:8px;cursor:pointer}.toneCard input{width:18px;height:18px;margin:0;accent-color:#176de9}.toneCard strong{color:#14213d;font-size:13px}.toneCard span,.toneCard small{font-size:11px;color:#64748b}.toneCard button{min-height:40px;border:1px solid #d1e3fc;border-radius:9px;background:#eff6ff;color:#176de9;font-weight:800;cursor:pointer}.toneVolume{display:grid;gap:8px;margin-top:16px;font-size:12px;font-weight:800;color:#475569}.toneVolume input{width:100%;accent-color:#176de9}
        .notificationSettingsCard{display:grid;grid-template-columns:58px minmax(0,1fr);gap:18px;padding:22px;border:1px solid #dfe7f1;border-radius:20px;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.045)}
        .notificationStatusIcon{width:58px;height:58px;display:grid;place-items:center;border-radius:17px;background:#edf5ff;font-size:27px}.notificationSettingsCopy{min-width:0}.notificationTitleRow{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.notificationTitleRow span{display:block;margin-bottom:4px;color:#176de9;font-size:10px;font-weight:900;letter-spacing:1.2px}.notificationTitleRow h2{margin:0;color:#14213d;font-size:23px}.notificationBadge{flex:0 0 auto;padding:7px 10px;border-radius:999px;font-size:10px;font-weight:900}.notificationBadge.on{background:#e9f9f1;color:#16875b}.notificationBadge.off{background:#f1f5f9;color:#64748b}.notificationSettingsCopy p{max-width:760px;margin:11px 0 0;color:#6f7f93;font-size:13px;line-height:1.6}.notificationWarning,.notificationMessage{margin-top:13px;padding:11px 13px;border-radius:12px;font-size:11px;line-height:1.5}.notificationWarning{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.notificationMessage{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}.notificationActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.notificationActions button{min-height:42px;padding:0 15px;border-radius:11px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.notificationPrimary{border:1px solid #176de9;background:#176de9;color:#fff}.notificationDanger{border:1px solid #fecaca;background:#fff1f2;color:#be123c}.notificationSecondary{border:1px solid #d8e1ed;background:#fff;color:#475569}.notificationActions button:disabled{opacity:.55;cursor:default}@media(max-width:640px){.notificationSettingsCard{grid-template-columns:1fr;padding:18px}.notificationTitleRow{align-items:center}.notificationStatusIcon{width:50px;height:50px}.notificationActions button{flex:1 1 140px}}
      `}</style>
    </section>
  );
}
