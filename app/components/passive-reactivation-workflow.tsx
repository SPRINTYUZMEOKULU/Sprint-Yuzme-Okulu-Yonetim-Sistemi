"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function findButton(text:string){return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b)=>(b.textContent||"").replace(/\s+/g," ").trim().toLocaleLowerCase("tr-TR").includes(text.toLocaleLowerCase("tr-TR")))||null}

export default function PassiveReactivationWorkflow(){
  const pathname=usePathname()||"/";
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const studentId=pathname.match(/^\/ogrenciler\/([^/]+)$/)?.[1]||"";
  const isFlow=Boolean(studentId&&typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("reactivate")==="1");

  useEffect(()=>{
    if(pathname!=="/ogrenciler/pasif-merkezi")return;
    const apply=()=>{
      document.querySelectorAll<HTMLElement>(".pcGrid article").forEach((card)=>{
        if(card.querySelector("[data-reactivation-workflow='1']"))return;
        const passiveBadge=card.querySelector<HTMLElement>(".passiveBadge");
        if(!passiveBadge)return;
        const fileLink=card.querySelector<HTMLAnchorElement>('footer a[href^="/ogrenciler/"]');
        if(!fileLink)return;
        const footer=fileLink.closest("footer");if(!footer)return;
        const a=document.createElement("a");
        a.href=`${fileLink.getAttribute("href")}?reactivate=1`;
        a.dataset.reactivationWorkflow="1";
        a.textContent="Aktife Al / Kaydı Düzenle";
        a.style.background="#eaf9f0";a.style.color="#17623b";a.style.border="1px solid #b9dfc5";
        footer.appendChild(a);
      })
    };
    apply();const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[pathname]);

  if(!isFlow)return null;

  function openProfile(){const button=findButton("Bilgileri Düzenle");if(button){button.click();setMessage("Öğrenci ve veli bilgi merkezi açıldı.")}else setMessage("Bilgileri Düzenle butonu bulunamadı.")}
  function openRenewal(){window.dispatchEvent(new CustomEvent("sprint:open-renewal"));setMessage("Yeni dönem kayıt yenileme merkezi açıldı. Eski dönem korunur.")}
  function openTransfer(){const button=findButton("Grup / Şube Değiştir")||findButton("Grup Değiştir");if(button){button.click();setMessage("Şube, grup ve program düzenleme alanı açıldı.")}else setMessage("Grup / Şube düzenleme alanı bulunamadı.")}
  async function activate(){if(!studentId||busy)return;if(!window.confirm("Öğrenci tekrar aktif duruma alınacak. Geçmiş kayıtlar korunacaktır. Devam edilsin mi?"))return;setBusy(true);setMessage("Aktife alma işlemi hazırlanıyor…");try{
    const createRes=await fetch("/api/student-status-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_type:"activate",student_id:studentId,reason:"Kursiyer yeniden kursa başladı",description:"Pasif Öğrenci Merkezi yeniden aktifleştirme akışı üzerinden oluşturuldu.",old_status:"passive",new_status:"active"})});
    const created=await createRes.json().catch(()=>({}));if(!createRes.ok||!created?.ok){setMessage(created?.error||"Aktife alma talebi oluşturulamadı.");return}
    if(created?.request?.id){const approveRes=await fetch("/api/approval-center",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:created.request.id,source:"student_status",action:"approve",review_note:"Yeniden aktifleştirme akışı üzerinden onaylandı."})});const approved=await approveRes.json().catch(()=>({}));if(approveRes.ok&&approved?.ok){setMessage("Öğrenci tekrar aktif duruma alındı. Geçmiş kayıtlar korunuyor.");setTimeout(()=>window.location.assign(`/ogrenciler/${studentId}`),900);return}}
    setMessage("Aktife alma talebi yönetici onayına gönderildi.");
  }catch{setMessage("Aktife alma sırasında bağlantı hatası oluştu.")}finally{setBusy(false)}}

  return <aside className="reactivationFlow">
    <div className="rfHead"><div><span>YENİDEN BAŞLAMA İŞLEMİ</span><strong>Aktife Al ve Kaydı Güncelle</strong><small>Eski dönem, yoklama ve ödeme geçmişi korunur. Yeni dönem ayrı kayıt olarak açılır.</small></div><button onClick={()=>window.location.assign(`/ogrenciler/${studentId}`)}>×</button></div>
    <div className="rfSteps">
      <button onClick={openProfile}><b>1</b><span><strong>Öğrenci / Veli Bilgileri</strong><small>Telefon, veli, doğum tarihi, acil kişi ve iletişim bilgilerini düzenle</small></span></button>
      <button onClick={openRenewal}><b>2</b><span><strong>Kayıt Yenile / Yeni Dönem</strong><small>Paket, ders sayısı, başlangıç tarihi, ödeme vadesi ve yeni dönem notunu düzenle</small></span></button>
      <button onClick={openTransfer}><b>3</b><span><strong>Şube / Grup / Seans</strong><small>Yeni dönemde şube, grup ve program değişecekse düzenle</small></span></button>
      <button className="activate" disabled={busy} onClick={activate}><b>✓</b><span><strong>{busy?"İşleniyor…":"Tekrar Aktife Al"}</strong><small>Düzenlemeler tamamlandıktan sonra öğrenciyi aktif duruma geçir</small></span></button>
    </div>
    {message?<div className="rfMessage">{message}</div>:null}
    <style jsx>{`.reactivationFlow{position:fixed;right:22px;bottom:22px;z-index:1475;width:min(510px,calc(100vw - 28px));padding:16px;border:1px solid #cfe0f7;border-radius:18px;background:#fff;box-shadow:0 20px 60px rgba(15,35,70,.2);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17345b}.rfHead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.rfHead>div{display:grid;gap:3px}.rfHead span{font-size:9px;letter-spacing:.12em;font-weight:950;color:#1769d2}.rfHead strong{font-size:17px}.rfHead small{font-size:10px;color:#718198;line-height:1.4}.rfHead>button{width:34px;height:34px;border:1px solid #d9e2ed;border-radius:10px;background:#f8fafc;color:#526579;font-size:20px}.rfSteps{display:grid;gap:8px;margin-top:13px}.rfSteps>button{display:flex;gap:10px;align-items:center;text-align:left;padding:11px 12px;border:1px solid #dce5ef;border-radius:12px;background:#f8fbff;color:#17345b;cursor:pointer}.rfSteps>button>b{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:#eaf2ff;color:#1769d2;flex:0 0 auto}.rfSteps span{display:grid;gap:2px}.rfSteps span strong{font-size:12px}.rfSteps span small{font-size:10px;color:#74859a}.rfSteps>button.activate{background:#eefaf4;border-color:#b9dfc5}.rfSteps>button.activate>b{background:#dff4e7;color:#17623b}.rfSteps>button:disabled{opacity:.55}.rfMessage{margin-top:10px;padding:10px 11px;border-radius:10px;background:#f3f7fb;color:#355b7d;font-size:11px;font-weight:800}@media(max-width:640px){.reactivationFlow{right:12px;bottom:12px}}`}</style>
  </aside>
}
