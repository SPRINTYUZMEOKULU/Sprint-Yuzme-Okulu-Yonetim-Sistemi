"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {approvedTrialMessage} from "./actions";
type Message=Extract<Awaited<ReturnType<typeof approvedTrialMessage>>,{ok:true}>;
export default function TrialApprovalMessage({studentId}:{studentId:string}) {
  const router=useRouter();
  const [data,setData]=useState<Message|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const lock=useRef(false);
  useEffect(()=>{let live=true;void approvedTrialMessage(studentId).then(r=>{if(!live)return;if(r.ok)setData(r);else setStatus(r.message)}).catch(()=>{if(live)setStatus("Bilgilendirme kontrol edilemedi.")});return()=>{live=false}},[studentId]);
  async function record(value:Message,event:"opened"|"confirmed") {
    const r=await fetch("/api/whatsapp-interactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...value,sourcePath:`/kayit-tamamlama/${studentId}`,queueEvent:event,templateKey:"trial_approved",templateTitle:"Deneme dersi onay bilgilendirmesi"})});
    const result=await r.json();if(!r.ok || !result.ok)throw new Error(result.message || "Gönderim geçmişi kaydedilemedi.");
  }
  async function act(confirm=false) {
    if(lock.current)return;lock.current=true;setBusy(true);setStatus("");
    let popup:Window|null=null;
    if(!confirm){popup=window.open("about:blank","_blank");if(popup)popup.opener=null;}
    try {
      const current=await approvedTrialMessage(studentId);
      if(!current.ok)throw new Error(current.message);
      if(current.sent){popup?.close();setData(current);setStatus("Bu onay bilgilendirmesinin gönderimi zaten teyit edilmiş.");return;}
      if(confirm){
        if(!current.opened)throw new Error("Önce onay mesajını WhatsApp üzerinden açıp gönderiniz.");
        await record(current,"confirmed");setData({...current,sent:true});setStatus("Gönderim teyidi öğrenci dosyasına ve mesaj geçmişine kaydedildi.");router.refresh();
      } else {
        await record(current,"opened");
        const href=`https://wa.me/${current.recipient}?text=${encodeURIComponent(current.message)}`;
        if(popup)popup.location.replace(href);else window.location.assign(href);
        popup=null;setData({...current,opened:true});setStatus("WhatsApp mesajı açıldı. Gönderdikten sonra aşağıdan gönderim teyidini kaydediniz.");
      }
    }catch(error){popup?.close();setStatus(error instanceof Error?error.message:"Bilgilendirme hazırlanamadı.");}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className="trialApprovalMessage"><strong>{data?.sent ? "✓ Onay bilgilendirmesi gönderildi olarak teyit edildi" : "Onay tamamlandı · Bilgilendirme"}</strong><p>Onaylanan dersin tarih ve saati kursiyere veya veliye bildirilmelidir. WhatsApp mesajını açmak gönderildiği anlamına gelmez.</p>{!data?.sent ? <><button type="button" disabled={busy || !data} onClick={()=>act()}>Onay mesajını WhatsApp’ta aç</button>{data?.opened ? <button type="button" disabled={busy} onClick={()=>act(true)}>WhatsApp’tan gönderdim · Teyidi kaydet</button> : null}</> : null}{status ? <p role="status">{status}</p> : null}</div>;
}
