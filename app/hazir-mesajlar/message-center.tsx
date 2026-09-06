"use client";

import { useMemo, useState, useTransition } from "react";
import {
  SPRINT_MESSAGE_TEMPLATES,
  renderSprintMessage,
  type SprintMessageKey,
} from "@/lib/messaging/sprint-message-catalog";
import { addGiftLessons } from "./actions";
import styles from "./page.module.css";

type Branch = { id:string; name:string; is_active:boolean };
type Group = { id:string; name:string; branch_id:string; course_type?:string|null; is_active:boolean };
type Schedule = { id:string; group_id:string; branch_id:string; weekday:number; start_time:string; end_time:string; is_active:boolean };
type Student = { id:string; first_name:string; last_name:string; phone?:string|null; guardian_phone?:string|null; branch_id?:string|null; preferred_group_id?:string|null; status:string };
type Membership = { student_id:string; group_id:string; is_active:boolean };
type Props = { branches:Branch[]; groups:Group[]; schedules:Schedule[]; students:Student[]; memberships:Membership[]; whatsappApiReady?:boolean };
type QueueItem = { studentId:string; studentName:string; phone:string; message:string; status:"waiting"|"opened"|"sent"|"error" };

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

export default function MessageCenter({branches,groups,schedules,students,memberships,whatsappApiReady=false}:Props){
  const [tab,setTab] = useState<"compose"|"templates"|"media"|"history"|"gift">("compose");
  const [branchId,setBranchId] = useState("");
  const [groupId,setGroupId] = useState("");
  const [scheduleId,setScheduleId] = useState("");
  const [selected,setSelected] = useState<string[]>([]);
  const [templateKey,setTemplateKey] = useState<SprintMessageKey>("registration");
  const [message,setMessage] = useState(SPRINT_MESSAGE_TEMPLATES[0].body);
  const [mediaUrl,setMediaUrl] = useState("");
  const [giftCount,setGiftCount] = useState(1);
  const [giftNote,setGiftNote] = useState("");
  const [result,setResult] = useState<any>(null);
  const [queue,setQueue] = useState<QueueItem[]>([]);
  const [queueIndex,setQueueIndex] = useState(0);
  const [apiSending,setApiSending] = useState(false);
  const [apiResult,setApiResult] = useState<string>("");
  const [pending,startTransition] = useTransition();

  const membershipMap = useMemo(()=>{
    const map = new Map<string,string[]>();
    memberships.forEach(m=>{ const arr=map.get(m.student_id)||[]; arr.push(m.group_id); map.set(m.student_id,arr); });
    return map;
  },[memberships]);

  const visibleGroups = useMemo(()=>groups.filter(g=>!branchId || g.branch_id===branchId),[groups,branchId]);
  const visibleSchedules = useMemo(()=>schedules.filter(s=>(!groupId||s.group_id===groupId)&&(!branchId||s.branch_id===branchId)),[schedules,groupId,branchId]);
  const audience = useMemo(()=>students.filter(s=>{
    if (branchId && s.branch_id!==branchId) return false;
    if (groupId && !(membershipMap.get(s.id)||[]).includes(groupId) && s.preferred_group_id!==groupId) return false;
    return true;
  }),[students,branchId,groupId,membershipMap]);

  const activeIds = selected.length ? selected : audience.map(s=>s.id);
  const activeStudents = audience.filter(s=>activeIds.includes(s.id));
  const selectedBranch = branches.find(b=>b.id===branchId);
  const selectedGroup = groups.find(g=>g.id===groupId);
  const selectedSchedule = schedules.find(s=>s.id===scheduleId);
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
    const t=SPRINT_MESSAGE_TEMPLATES.find(x=>x.key===key); if(!t)return;
    setTemplateKey(key); setMessage(t.body); setTab("compose"); setQueue([]); setApiResult("");
  }

  function toggleStudent(id:string){ setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]); setQueue([]); }

  function buildQueue(){
    const prepared:QueueItem[] = activeStudents.map(s=>({
      studentId:s.id,
      studentName:studentName(s),
      phone:cleanPhone(s.guardian_phone)||cleanPhone(s.phone),
      message:renderSprintMessage(message,variablesFor(s)) + (mediaUrl?`\n\n📎 Görsel / Afiş: ${mediaUrl}`:""),
      status:"waiting" as const,
    })).filter(x=>Boolean(x.phone));
    if(!prepared.length){ window.alert("Seçili kursiyerlerde WhatsApp için geçerli telefon numarası bulunamadı."); return; }
    setQueue(prepared); setQueueIndex(0); setApiResult("");
  }

  function openQueueItem(index:number){
    const item=queue[index]; if(!item)return;
    const url=`https://wa.me/${item.phone}?text=${encodeURIComponent(item.message)}`;
    window.open(url,"_blank","noopener,noreferrer");
    setQueue(prev=>prev.map((q,i)=>i===index?{...q,status:"opened"}:q));
  }

  function markSentAndNext(){
    setQueue(prev=>prev.map((q,i)=>i===queueIndex?{...q,status:"sent"}:q));
    setQueueIndex(i=>Math.min(i+1,Math.max(queue.length-1,0)));
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
        setQueue(prepared); setQueueIndex(0); setTemplateKey("gift");
      }
    });
  }

  const currentQueueItem=queue[queueIndex];

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
            <label>Seans<select value={scheduleId} onChange={e=>{setScheduleId(e.target.value);setQueue([]);}}><option value="">Tüm seanslar</option>{visibleSchedules.map(s=><option key={s.id} value={s.id}>{DAYS[s.weekday]} {s.start_time.slice(0,5)}-{s.end_time.slice(0,5)}</option>)}</select></label>
          </div>
          <div className={styles.summaryBox}><span>Toplam <b>{activeIds.length}</b></span><span>WhatsApp hazır <b>{sendableCount}</b></span><span>Telefon eksik <b>{missingPhoneCount}</b></span></div>
          <div className={styles.audienceHead}><span>Aktif kursiyerler</span><div><button onClick={()=>setSelected(audience.map(s=>s.id))}>Tümünü seç</button><button onClick={()=>setSelected([])}>Seçimi temizle</button></div></div>
          <div className={styles.people}>
            {audience.slice(0,120).map(s=><label key={s.id} className={styles.person}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggleStudent(s.id)}/><div><b>{studentName(s)}</b><small>{s.guardian_phone||s.phone||"Telefon eksik"}</small></div></label>)}
            {!audience.length && <p className={styles.muted}>Bu filtrede aktif kursiyer bulunamadı.</p>}
          </div>
        </div>

        {tab==="templates" ? <div className={styles.card}><div className={styles.cardHead}><div><span>2</span><h2>Merkezi Akıllı Mesaj Kütüphanesi</h2></div><strong>{SPRINT_MESSAGE_TEMPLATES.length} şablon</strong></div><p className={styles.muted}>Öğrenci, ödeme, ders operasyonu ve Hazır Mesajlar ekranlarında aynı durum için aynı mesaj dili kullanılacak merkezi katalog budur.</p><div className={styles.templateGrid}>{SPRINT_MESSAGE_TEMPLATES.map(t=><button key={t.key} className={styles.templateCard} onClick={()=>chooseTemplate(t.key)}><i>{t.icon}</i><b>{t.title}</b><small>{t.category} · şablonu aç ve düzenle</small></button>)}</div></div> : null}

        {tab==="gift" ? <div className={styles.card}><div className={styles.cardHead}><div><span>🎁</span><h2>SPRİNT Hediye Ders Merkezi</h2></div></div><div className={styles.giftBanner}><div className={styles.giftIcon}>🎁</div><div><b>Kursiyerinize özel hediye ders tanımlayın</b><p>Ders hakkı otomatik artar, planlanan bitiş tarihi seçilen grup/seans düzenine göre uzar ve kursiyer işlem geçmişine kaydedilir.</p></div></div><div className={styles.filters}><label>Hediye ders sayısı<select value={giftCount} onChange={e=>setGiftCount(Number(e.target.value))}>{[1,2,3,4,5,6,8,10,12].map(n=><option key={n} value={n}>{n} ders</option>)}</select></label><label className={styles.wide}>Özel not<input value={giftNote} onChange={e=>setGiftNote(e.target.value)} placeholder="Örn. SPRİNT tarafından başarı hediyesi"/></label></div><div className={styles.summaryBox}><span>Seçili kursiyer <b>{activeIds.length}</b></span><span>Grup <b>{selectedGroup?.name||"Seçilmedi"}</b></span><span>Seans <b>{programText}</b></span></div><button className={styles.primary} disabled={pending||!activeIds.length||!groupId} onClick={applyGift}>{pending?"Hediye dersler işleniyor…":`${activeIds.length} Kişiye Hediye Ders Ekle`}</button>{result&&<div className={result.ok?styles.success:styles.error}>{result.message}</div>}</div> : null}

        {tab!=="templates" && tab!=="gift" ? <div className={styles.card}>
          <div className={styles.cardHead}><div><span>2</span><h2>Mesaj İçeriği</h2></div></div>
          <div className={styles.quickTemplates}>{SPRINT_MESSAGE_TEMPLATES.map(t=><button key={t.key} className={templateKey===t.key?styles.chipActive:""} onClick={()=>chooseTemplate(t.key)}>{t.icon} {t.title}</button>)}</div>
          <textarea className={styles.textarea} value={message} onChange={e=>{setMessage(e.target.value);setQueue([]);}} rows={13}/>
          <div className={styles.variables}><b>Akıllı alanlar:</b> <code>{`{ogrenci_adi}`}</code> <code>{`{sube}`}</code> <code>{`{grup}`}</code> <code>{`{program}`}</code> <code>{`{bitis_tarihi}`}</code> <code>{`{kalan_ders}`}</code></div>
          <label className={styles.mediaField}>Afiş / görsel bağlantısı<input value={mediaUrl} onChange={e=>{setMediaUrl(e.target.value);setQueue([]);}} placeholder="https://... görsel bağlantısı"/></label>
        </div> : null}

        {queue.length>0 && <div className={styles.card}>
          <div className={styles.cardHead}><div><span>3</span><h2>WhatsApp Gönderim Kuyruğu</h2></div><strong>{queue.filter(q=>q.status==="sent").length}/{queue.length}</strong></div>
          <div className={styles.summaryBox}><span>Sıradaki <b>{currentQueueItem?.studentName||"—"}</b></span><span>Telefon <b>{currentQueueItem?.phone||"—"}</b></span><span>Durum <b>{currentQueueItem?.status||"—"}</b></span></div>
          <p className={styles.muted}>WhatsApp bağlantısı tarayıcıdan mesajı otomatik gönderemez. Bu kuyruk her kursiyeri tek tek güvenli biçimde hazırlar; WhatsApp'ta gönderimi onayladıktan sonra “Gönderildi, sıradaki” düğmesine basın.</p>
          <div className={styles.quickTemplates}>
            <button className={styles.primary} onClick={()=>openQueueItem(queueIndex)} disabled={!currentQueueItem}>Sıradakini WhatsApp'ta Aç</button>
            <button onClick={markSentAndNext} disabled={!currentQueueItem}>Gönderildi · Sıradaki</button>
            <button onClick={()=>setQueue([])}>Kuyruğu Kapat</button>
          </div>
          <div className={styles.people}>{queue.slice(0,120).map((q,i)=><div key={`${q.studentId}-${i}`} className={styles.person}><div><b>{i+1}. {q.studentName}</b><small>{q.phone} · {q.status==="sent"?"Gönderildi":q.status==="opened"?"WhatsApp açıldı":"Bekliyor"}</small></div></div>)}</div>
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
        {whatsappApiReady ? <button className={styles.whatsapp} disabled={apiSending||!sendableCount} onClick={sendViaApi}>{apiSending?"Toplu gönderiliyor…":`${sendableCount} Kişiye Toplu Gönder`}</button> : <button className={styles.whatsapp} disabled={!sendableCount} onClick={buildQueue}>{sendableCount} Kişilik WhatsApp Kuyruğu Oluştur</button>}
        {apiResult&&<div className={apiResult.includes("başarısız")?styles.error:styles.success}>{apiResult}</div>}
        <p className={styles.note}>{whatsappApiReady?"API aktif olduğunda gönderim sunucu üzerinden yapılır. Meta'nın müşteri hizmeti penceresi ve onaylı şablon kuralları yine geçerlidir.":"Gerçek tek-tuş toplu gönderim için Meta WhatsApp Business Cloud API telefon numarası ve erişim anahtarı Vercel ortam değişkenlerine bağlanmalıdır. API hazır olana kadar güvenli gönderim kuyruğu kullanılabilir."}</p>
      </aside>
    </div>
  </section>;
}
