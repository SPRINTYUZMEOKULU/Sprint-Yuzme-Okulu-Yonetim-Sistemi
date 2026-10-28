"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  SPRINT_MESSAGE_TEMPLATES,
  renderSprintMessage,
  type SprintMessageKey,
  type SprintMessageTemplate,
} from "@/lib/messaging/sprint-message-catalog";
import { addGiftLessons } from "./actions";
import styles from "./page.module.css";

type Branch = { id:string; name:string; is_active:boolean };
type Group = { id:string; name:string; branch_id:string; course_type?:string|null; is_active:boolean };
type Schedule = { id:string; group_id:string; branch_id:string; weekday:number; start_time:string; end_time:string; is_active:boolean };
type Student = { id:string; first_name:string; last_name:string; phone?:string|null; guardian_phone?:string|null; branch_id?:string|null; preferred_group_id?:string|null; status:string };
type Membership = { student_id:string; group_id:string; is_active:boolean };
type AttendancePlan = { student_id:string; group_id?:string|null; selected_weekdays?:number[]|null; is_active:boolean };
type Props = { templates?:SprintMessageTemplate[]; branches:Branch[]; groups:Group[]; schedules:Schedule[]; students:Student[]; memberships:Membership[]; attendancePlans:AttendancePlan[]; whatsappApiReady?:boolean };
type QueueItem = { interactionId?:string; templateKey?:string; templateTitle?:string; studentId:string; studentName:string; phone:string; message:string; status:"waiting"|"opened"|"sent"|"error" };

const DAYS:Record<number,string> = {1:"Pzt",2:"Sal",3:"Çar",4:"Per",5:"Cum",6:"Cmt",7:"Paz"};

function studentName(s:Student){ return `${s.first_name||""} ${s.last_name||""}`.trim(); }
function cleanPhone(v?:string|null){
  const digits=(v||"").replace(/\D/g,"");
  if(!digits) return "";
  if(digits.startsWith("90")) return digits;
  if(digits.startsWith("0")) return `90${digits.slice(1)}`;
  if(digits.length===10) return `90${digits}`;
  return digits;
}

export default function MessageCenter({templates=SPRINT_MESSAGE_TEMPLATES,branches,groups,schedules,students,memberships,attendancePlans,whatsappApiReady=false}:Props){
  const [tab,setTab] = useState<"compose"|"templates"|"media"|"history"|"gift">("compose");
  const [branchId,setBranchId] = useState("");
  const [groupId,setGroupId] = useState("");
  const [scheduleId,setScheduleId] = useState("");
  const [selected,setSelected] = useState<string[]>([]);
  const [templateKey,setTemplateKey] = useState<SprintMessageKey>("registration");
  const [message,setMessage] = useState(templates[0].body);
  const [mediaUrl,setMediaUrl] = useState("");
  const [giftCount,setGiftCount] = useState(1);
  const [giftNote,setGiftNote] = useState("");
  const [result,setResult] = useState<any>(null);
  const [queue,updateQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const lastQueueAction = useRef(0);
  const queueBusyRef = useRef(false);
  const [queueBusy,setQueueBusy] = useState(false);
  const [queueError,setQueueError] = useState("");
  const queueStorageReady = useRef(false);
  const queueStorageKey = "sprintos-ready-message-queue-v2";
  function setQueue(next:QueueItem[]){
    queueRef.current=next;
    updateQueue(next);
    setQueueError("");
    // Persist before leaving for WhatsApp, even if Android unloads this page.
    try{
      if(next.length) sessionStorage.setItem(queueStorageKey,JSON.stringify({savedAt:Date.now(),queue:next}));
      else sessionStorage.removeItem(queueStorageKey);
    }catch{ /* The in-memory queue remains usable when storage is unavailable. */ }
  }
  useEffect(()=>{
    if(queueStorageReady.current)return;
    queueStorageReady.current=true;
    try{
      const raw=sessionStorage.getItem(queueStorageKey);
      if(!raw)return;
      const saved=JSON.parse(raw);
      const allowedIds=new Set(students.map(s=>s.id));
      if(!Array.isArray(saved.queue)||!Number.isFinite(saved.savedAt)||Date.now()-saved.savedAt>86400000){
        sessionStorage.removeItem(queueStorageKey);return;
      }
      const restored=saved.queue.filter((q:QueueItem)=>
        q && allowedIds.has(q.studentId) && typeof q.phone==="string" &&
        typeof q.message==="string" && typeof q.studentName==="string" &&
        ["waiting","opened","sent","error"].includes(q.status));
      if(restored.length!==saved.queue.length){sessionStorage.removeItem(queueStorageKey);return;}
      queueRef.current=restored;
      updateQueue(restored);
      setSelected(restored.map((q:QueueItem)=>q.studentId));
    }catch{ /* Ignore an unavailable or invalid saved queue. */ }
  },[students]);
  const [apiSending,setApiSending] = useState(false);
  const [apiResult,setApiResult] = useState<string>("");
  const [pending,startTransition] = useTransition();

  const membershipMap = useMemo(()=>{
    const map = new Map<string,string[]>();
    memberships.forEach(m=>{ const arr=map.get(m.student_id)||[]; arr.push(m.group_id); map.set(m.student_id,arr); });
    return map;
  },[memberships]);

  const attendancePlanMap = useMemo(()=>{
    const map = new Map<string,AttendancePlan>();
    attendancePlans.forEach(p=>{ if(!map.has(p.student_id)) map.set(p.student_id,p); });
    return map;
  },[attendancePlans]);

  const visibleGroups = useMemo(()=>groups.filter(g=>!branchId || g.branch_id===branchId),[groups,branchId]);
  const visibleSchedules = useMemo(()=>schedules.filter(s=>(!groupId||s.group_id===groupId)&&(!branchId||s.branch_id===branchId)),[schedules,groupId,branchId]);
  const selectedSchedule = schedules.find(s=>s.id===scheduleId);
  const audience = useMemo(()=>students.filter(s=>{
    if (branchId && s.branch_id!==branchId) return false;
    if (groupId && !(membershipMap.get(s.id)||[]).includes(groupId) && s.preferred_group_id!==groupId) return false;
    if (selectedSchedule) {
      const plan=attendancePlanMap.get(s.id);
      if (plan?.group_id && plan.group_id!==selectedSchedule.group_id) return false;
      if (Array.isArray(plan?.selected_weekdays) && plan!.selected_weekdays!.length && !plan!.selected_weekdays!.map(Number).includes(Number(selectedSchedule.weekday))) return false;
    }
    return true;
  }),[students,branchId,groupId,membershipMap,attendancePlanMap,selectedSchedule]);

  const activeIds = selected.length ? selected.filter(id=>audience.some(s=>s.id===id)) : audience.map(s=>s.id);
  const activeStudents = audience.filter(s=>activeIds.includes(s.id));
  const selectedBranch = branches.find(b=>b.id===branchId);
  const selectedGroup = groups.find(g=>g.id===groupId);
  const programText = selectedSchedule
    ? `${DAYS[selectedSchedule.weekday]} ${selectedSchedule.start_time.slice(0,5)}-${selectedSchedule.end_time.slice(0,5)}`
    : visibleSchedules.map(s=>`${DAYS[s.weekday]} ${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}`).join(" / ") || "Program seçilmedi";

  function variablesFor(student?:Student){
    return {
      ogrenci_adi: student ? studentName(student) : "Kursiyer Adı",
      sube: selectedBranch?.name || "Şube",
      grup: selectedGroup?.name || "Grup",
      program: programText,
      baslangic_tarihi: "—",
      bitis_tarihi: "—",
      normal_bitis_tarihi: "—",
      kalan_ders: "—",
      kalan_odeme: "—",
      vade_tarihi: "—",
      telafi_tarihi: "—",
      telafi_grubu: selectedGroup?.name || "—",
      telafi_saati: selectedSchedule ? `${selectedSchedule.start_time.slice(0,5)}-${selectedSchedule.end_time.slice(0,5)}` : "—",
      son_devamsizlik_tarihi: "—",
      gecis_tarihi: "—",
      hediye_ders: giftCount,
      mesaj: "Duyuru metniniz burada görüntülenir.",
    };
  }

  const preview = renderSprintMessage(message, variablesFor(activeStudents[0]));
  const sendableCount = activeStudents.filter(s=>cleanPhone(s.guardian_phone)||cleanPhone(s.phone)).length;
  const missingPhoneCount = Math.max(0,activeStudents.length-sendableCount);

  function chooseTemplate(key:SprintMessageKey){
    const t=templates.find(x=>x.key===key); if(!t)return;
    setTemplateKey(key); setMessage(t.body); setTab("compose"); setQueue([]); setApiResult("");
  }

  function toggleStudent(id:string){ setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]); setQueue([]); }

  function buildQueue(){
    const prepared:QueueItem[] = activeStudents.map(s=>({
      interactionId:crypto.randomUUID(), templateKey, templateTitle:templates.find(t=>t.key===templateKey)?.title,
      studentId:s.id,
      studentName:studentName(s),
      phone:cleanPhone(s.guardian_phone)||cleanPhone(s.phone),
      message:renderSprintMessage(message,variablesFor(s)) + (mediaUrl?`\n\n📎 Görsel / Afiş: ${mediaUrl}`:""),
      status:"waiting" as const,
    })).filter(x=>Boolean(x.phone));
    if(!prepared.length){ window.alert("Seçili kursiyerlerde WhatsApp için geçerli telefon numarası bulunamadı."); return; }
    if(queueRef.current.length)return;
    setQueue(prepared); setApiResult("");
  }

  async function recordQueueEvent(item:QueueItem,event:"opened"|"confirmed"){
    const response=await fetch("/api/whatsapp-interactions",{
      method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,
      body:JSON.stringify({studentId:item.studentId,recipient:item.phone,message:item.message,
        sourcePath:"/hazir-mesajlar",queueEvent:event,interactionId:item.interactionId,
        templateKey:item.templateKey,templateTitle:item.templateTitle}),
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok)throw new Error(data?.message||"Mesaj geçmişi kaydedilemedi. Tekrar deneyin.");
  }

  async function advanceQueue(){
    const now=Date.now();
    if(queueBusyRef.current||now-lastQueueAction.current<700)return;
    lastQueueAction.current=now;
    let next=queueRef.current.map(q=>({...q,interactionId:q.interactionId||crypto.randomUUID()}));
    setQueue(next);
    const opened=next.findIndex(q=>q.status==="opened");
    const index=next.findIndex(q=>q.status==="waiting"||q.status==="error");
    // Reserve a window in the user's click gesture before awaiting the history save.
    let popup:Window|null=null;
    if(index>=0){
      try{popup=window.open("about:blank","_blank");if(popup)popup.opener=null;}catch{}
    }
    queueBusyRef.current=true;setQueueBusy(true);
    try{
      if(opened>=0){
        await recordQueueEvent(next[opened],"confirmed");
        next=next.map((q,i)=>i===opened?{...q,status:"sent" as const}:q);
        setQueue(next);
      }
      if(index<0)return;
      if(!popup){
        setQueue(next.map((q,i)=>i===index?{...q,status:"error"}:q));
        setQueueError("WhatsApp penceresi açılamadı. Açılır pencere iznini kontrol edip tekrar deneyin.");
        return;
      }
      const item=next[index];
      popup.location.href=`https://wa.me/${item.phone}?text=${encodeURIComponent(item.message)}`;
      setQueue(next.map((q,i)=>i===index?{...q,status:"opened"}:q));
      popup=null;
      try{await recordQueueEvent(item,"opened");}
      catch{setQueueError("WhatsApp açıldı; geçmiş kaydı henüz alınamadı. Gönderimi onayladığınızda yeniden kaydedilecek.");}
    }catch(error){
      popup?.close();
      setQueueError(error instanceof Error?error.message:"Gönderim onayı kaydedilemedi. Tekrar deneyin.");
    }finally{queueBusyRef.current=false;setQueueBusy(false);}
  }

  async function sendViaApi(){
    if(!whatsappApiReady){ buildQueue(); return; }
    const payload = activeStudents.map(s=>({
      studentId:s.id,
      recipient:cleanPhone(s.guardian_phone)||cleanPhone(s.phone),
      message:renderSprintMessage(message,variablesFor(s)) + (mediaUrl?`\n\n${mediaUrl}`:""),
    })).filter(x=>Boolean(x.recipient));
    if(!payload.length){ window.alert("Gönderilebilir telefon numarası bulunamadı."); return; }
    if(!window.confirm(`${payload.length} kişiye WhatsApp Business API üzerinden gönderim başlatılsın mı?`)) return;
    setApiSending(true); setApiResult("");
    try{
      const res=await fetch("/api/whatsapp/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:payload,templateKey,mediaUrl:mediaUrl||null})});
      const data=await res.json();
      if(!res.ok) throw new Error(data?.message||"WhatsApp gönderimi başarısız.");
      setApiResult(`${data.sent||0} gönderildi${data.failed?`, ${data.failed} başarısız`:""}.`);
    }catch(error){ setApiResult(error instanceof Error?error.message:"WhatsApp gönderimi başarısız."); }
    finally{ setApiSending(false); }
  }

  function applyGift(){
    if(!groupId) return window.alert("Hediye ders için grup seçin.");
    startTransition(async()=>{
      const response = await addGiftLessons({studentIds:activeIds,lessonCount:giftCount,targetGroupId:groupId,targetScheduleId:scheduleId||null,note:giftNote});
      setResult(response);
      if(response?.messages?.length){
        const prepared=response.messages.map((m:any)=>({studentId:m.studentId,studentName:m.studentName,phone:cleanPhone(m.recipient),message:m.message,status:"waiting" as const})).filter((q:QueueItem)=>Boolean(q.phone));
        setQueue(prepared); setTemplateKey("gift");
      }
    });
  }

  const currentQueueItem=queue.find(q=>q.status==="opened") || queue.find(q=>q.status==="waiting"||q.status==="error");
  const sentCount=queue.filter(q=>q.status==="sent").length;
  const queueComplete=queue.length>0 && sentCount===queue.length;

  return <section className={styles.workspace}>
    <nav className={styles.tabs}>
      {[["compose","Toplu Mesaj Merkezi"],["templates","Mesaj Şablonları"],["media","Afiş / Görsel"],["gift","Hediye Ders"],["history","Geçmiş"]].map(([key,label])=><button key={key} className={tab===key?styles.activeTab:""} onClick={()=>setTab(key as any)}>{label}</button>)}
    </nav>

    <div className={styles.grid}>
      <div className={styles.leftCol}>
        <div className={styles.card}>
          <div className={styles.cardHead}><div><span>1</span><h2>Alıcıları Belirle</h2></div><strong>{activeIds.length} kişi</strong></div>
          <div className={styles.filters}>
            <label>Şube<select value={branchId} onChange={e=>{setBranchId(e.target.value);setGroupId("");setScheduleId("");setSelected([]);setQueue([]);}}><option value="">Tüm şubeler</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label>Grup<select value={groupId} onChange={e=>{setGroupId(e.target.value);setScheduleId("");setSelected([]);setQueue([]);}}><option value="">Tüm gruplar</option>{visibleGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label>Seans<select value={scheduleId} onChange={e=>{setScheduleId(e.target.value);setSelected([]);setQueue([]);}}><option value="">Tüm seanslar</option>{visibleSchedules.map(s=><option key={s.id} value={s.id}>{DAYS[s.weekday]} {s.start_time.slice(0,5)}-{s.end_time.slice(0,5)}</option>)}</select></label>
          </div>
          <div className={styles.summaryBox}><span>Hedef kitle <b>{activeIds.length}</b></span><span>WhatsApp hazır <b>{sendableCount}</b></span><span>Telefon eksik <b>{missingPhoneCount}</b></span></div>
          <div className={styles.audienceHead}><span>Aktif kursiyerler · seçim yoksa filtredeki herkes</span><div><button onClick={()=>setSelected(audience.map(s=>s.id))}>Tümünü işaretle</button><button onClick={()=>setSelected([])}>Filtredeki herkesi kullan</button></div></div>
          <div className={styles.people}>
            {audience.slice(0,120).map(s=><label key={s.id} className={styles.person}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggleStudent(s.id)}/><div><b>{studentName(s)}</b><small>{s.guardian_phone||s.phone||"Telefon eksik"}</small></div></label>)}
            {!audience.length && <p className={styles.muted}>Bu şube / grup / seans filtresinde aktif kursiyer bulunamadı.</p>}
          </div>
        </div>

        {tab==="templates" ? <div className={styles.card}><div className={styles.cardHead}><div><span>2</span><h2>Merkezi Akıllı Mesaj Kütüphanesi</h2></div><strong>{templates.length} şablon</strong></div><p className={styles.muted}>Öğrenci, ödeme, ders operasyonu ve Hazır Mesajlar ekranlarında aynı durum için aynı mesaj dili kullanılacak merkezi katalog budur.</p><div className={styles.templateGrid}>{templates.map(t=><button key={t.key} className={styles.templateCard} onClick={()=>chooseTemplate(t.key)}><i>{t.icon}</i><b>{t.title}</b><small>{t.category} · şablonu aç ve düzenle</small></button>)}</div></div> : null}

        {tab==="gift" ? <div className={styles.card}><div className={styles.cardHead}><div><span>🎁</span><h2>SPRİNT Hediye Ders Merkezi</h2></div></div><div className={styles.giftBanner}><div className={styles.giftIcon}>🎁</div><div><b>Kursiyerinize özel hediye ders tanımlayın</b><p>Ders hakkı otomatik artar, planlanan bitiş tarihi seçilen grup/seans düzenine göre uzar ve kursiyer işlem geçmişine kaydedilir.</p></div></div><div className={styles.filters}><label>Hediye ders sayısı<select value={giftCount} onChange={e=>setGiftCount(Number(e.target.value))}>{[1,2,3,4,5,6,8,10,12].map(n=><option key={n} value={n}>{n} ders</option>)}</select></label><label className={styles.wide}>Özel not<input value={giftNote} onChange={e=>setGiftNote(e.target.value)} placeholder="Örn. SPRİNT tarafından başarı hediyesi"/></label></div><div className={styles.summaryBox}><span>Seçili kursiyer <b>{activeIds.length}</b></span><span>Grup <b>{selectedGroup?.name||"Seçilmedi"}</b></span><span>Seans <b>{programText}</b></span></div><button className={styles.primary} disabled={pending||!activeIds.length||!groupId} onClick={applyGift}>{pending?"Hediye dersler işleniyor…":`${activeIds.length} Kişiye Hediye Ders Ekle`}</button>{result&&<div className={result.ok?styles.success:styles.error}>{result.message}</div>}</div> : null}

        {tab!=="templates" && tab!=="gift" ? <div className={styles.card}>
          <div className={styles.cardHead}><div><span>2</span><h2>Mesaj İçeriği</h2></div></div>
          <div className={styles.quickTemplates}>{templates.map(t=><button key={t.key} className={templateKey===t.key?styles.chipActive:""} onClick={()=>chooseTemplate(t.key)}>{t.icon} {t.title}</button>)}</div>
          <textarea className={styles.textarea} value={message} onChange={e=>{setMessage(e.target.value);setQueue([]);}} rows={13}/>
          <div className={styles.variables}><b>Akıllı alanlar:</b> <code>{`{ogrenci_adi}`}</code> <code>{`{sube}`}</code> <code>{`{grup}`}</code> <code>{`{program}`}</code> <code>{`{bitis_tarihi}`}</code> <code>{`{kalan_ders}`}</code></div>
          <label className={styles.mediaField}>Afiş / görsel bağlantısı<input value={mediaUrl} onChange={e=>{setMediaUrl(e.target.value);setQueue([]);}} placeholder="https://... görsel bağlantısı"/></label>
        </div> : null}

        {queue.length>0 && <div className={styles.card}>
          <div className={styles.cardHead}><div><span>3</span><h2>WhatsApp Gönderim Kuyruğu · v2.2</h2></div><strong>{queue.filter(q=>q.status==="sent").length}/{queue.length}</strong></div>
          <div className={styles.summaryBox}><span>Sıradaki <b>{currentQueueItem?.studentName||"—"}</b></span><span>Telefon <b>{currentQueueItem?.phone||"—"}</b></span><span>Durum <b>{currentQueueItem?.status==="opened"?"Gönderim onayı bekleniyor":currentQueueItem?.status==="error"?"Tekrar deneyin":queueComplete?"Tamamlandı":"Hazır"}</b></span></div>
          <progress className={styles.queueProgress} value={sentCount} max={queue.length} aria-label="Onaylanan gönderimler" />
          <p className={styles.muted} aria-live="polite">{queueComplete?"Tüm gönderimleri onayladınız. Kuyruk tamamlandı.":currentQueueItem?.status==="opened"?"WhatsApp’ta mesajı gönderin. Döndüğünüzde aşağıdaki düğmeyle gönderimi onaylayıp sıradaki kişiyi açın.":"Mesaj WhatsApp’ta hazır açılır. Gönder düğmesine WhatsApp içinde basmanız gerekir."}</p>
          {queueError && <p className={styles.error} role="alert">{queueError}</p>}
          <div className={styles.queueActions}>
            <button className={styles.primary} onClick={advanceQueue} disabled={!currentQueueItem||queueBusy}>
              {queueBusy?"Geçmiş kaydediliyor…":queueComplete?"Gönderim tamamlandı":currentQueueItem?.status==="opened"?(sentCount===queue.length-1?"Gönderimi Onayla ve Tamamla":"Gönderimi Onayla ve Sıradakini Aç"):currentQueueItem?.status==="error"?"WhatsApp’ı Tekrar Aç":"WhatsApp’ta Gönderime Başla"}
            </button>
            <button disabled={queueBusy} onClick={()=>{if(sentCount<queue.length&&!window.confirm("Kuyruğu kapatmak kalan gönderimleri iptal eder. Kapatılsın mı?"))return;setQueue([]);}}>Kuyruğu Kapat</button>
          </div>
          <div className={styles.people}>{queue.slice(0,120).map((q,i)=><div key={`${q.studentId}-${i}`} className={styles.person}><div><b>{i+1}. {q.studentName}</b><small>{q.phone} · {q.status==="sent"?"Gönderildi":q.status==="opened"?"Gönderim onayı bekleniyor":q.status==="error"?"Açılamadı · tekrar deneyin":"Bekliyor"}</small></div></div>)}</div>
        </div>}
      </div>

      <aside className={styles.previewCol}>
        <div className={styles.previewTitle}><span>WhatsApp önizlemesi</span><strong>{activeIds.length} alıcı</strong></div>
        <div className={styles.phone}>
          <div className={styles.phoneHead}><span>←</span><div className={styles.avatar}>S</div><div><b>SPRİNT YÜZME OKULU</b><small>WhatsApp Business</small></div></div>
          <div className={styles.chat}>
            {mediaUrl && <div className={styles.mediaPreview}><img src={mediaUrl} alt="Mesaj afişi"/><span>SPRİNT duyuru görseli</span></div>}
            <div className={styles.bubble}>{preview.split("\n").map((line,i)=><span key={i}>{line||" "}</span>)}<small>Şimdi ✓✓</small></div>
          </div>
        </div>
        <div className={styles.sendBox}><div><b>{whatsappApiReady?"WhatsApp Business API hazır":"Manuel gönderim kuyruğu hazır"}</b><small>{sendableCount} gönderilebilir · {missingPhoneCount} telefon eksik</small></div></div>
        {whatsappApiReady ? <button className={styles.whatsapp} disabled={apiSending||!sendableCount} onClick={sendViaApi}>{apiSending?"Toplu gönderiliyor…":`${sendableCount} Kişiye Toplu Gönder`}</button> : <button className={styles.whatsapp} onClick={buildQueue} disabled={queue.length>0||!sendableCount}>{sendableCount} Kişilik WhatsApp Kuyruğu Oluştur</button>}
        {apiResult&&<div className={apiResult.includes("başarısız")?styles.error:styles.success}>{apiResult}</div>}
        <p className={styles.note}>{whatsappApiReady?"API aktif olduğunda gönderim sunucu üzerinden yapılır. Meta'nın müşteri hizmeti penceresi ve onaylı şablon kuralları yine geçerlidir.":"Gerçek tek-tuş toplu gönderim için Meta WhatsApp Business Cloud API telefon numarası ve erişim anahtarı Vercel ortam değişkenlerine bağlanmalıdır. API hazır olana kadar güvenli gönderim kuyruğu kullanılabilir."}</p>
      </aside>
    </div>
  </section>;
}
