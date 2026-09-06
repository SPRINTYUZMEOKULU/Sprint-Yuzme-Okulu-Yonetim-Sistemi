"use client";

import { useMemo, useState, useTransition } from "react";
import { addGiftLessons } from "./actions";
import styles from "./page.module.css";

type Branch = { id:string; name:string; is_active:boolean };
type Group = { id:string; name:string; branch_id:string; course_type?:string|null; is_active:boolean };
type Schedule = { id:string; group_id:string; branch_id:string; weekday:number; start_time:string; end_time:string; is_active:boolean };
type Student = { id:string; first_name:string; last_name:string; phone?:string|null; guardian_phone?:string|null; branch_id?:string|null; preferred_group_id?:string|null; status:string };
type Membership = { student_id:string; group_id:string; is_active:boolean };

type Props = { branches:Branch[]; groups:Group[]; schedules:Schedule[]; students:Student[]; memberships:Membership[] };

const DAYS:Record<number,string> = {1:"Pzt",2:"Sal",3:"Çar",4:"Per",5:"Cum",6:"Cmt",7:"Paz"};
const templates = [
  {key:"registration", title:"Kayıt Tamamlandı", icon:"✅", text:"Değerli Velimiz, {ogrenci_adi} öğrencimizin kaydı başarıyla tamamlanmıştır.\n\n🏊 Şube: {sube}\n👥 Grup: {grup}\n🗓️ Program: {program}\n\nSPRİNT YÜZME OKULU\n0551 896 83 19"},
  {key:"pool", title:"Havuz Kapalı", icon:"🏊", text:"Değerli Velimiz, {sube} şubemizdeki {program} seansımız tesis kaynaklı nedenle bugün gerçekleştirilemeyecektir. Ders hakkınız sisteminizde korunacaktır.\n\nSPRİNT YÜZME OKULU"},
  {key:"makeup", title:"Telafi Eklendi", icon:"🟣", text:"Değerli Velimiz, yapılamayan dersiniz için telafi hakkınız sisteminize eklenmiştir. Güncel planınız: {program}.\n\nSPRİNT YÜZME OKULU"},
  {key:"transfer", title:"Grup / Saat Değişikliği", icon:"🔄", text:"Değerli Velimiz, {ogrenci_adi} öğrencimizin yeni programı {sube} · {grup} · {program} olarak güncellenmiştir.\n\nSPRİNT YÜZME OKULU"},
  {key:"payment", title:"Ödeme Bilgilendirmesi", icon:"💳", text:"Değerli Velimiz, ödemeniz alınmış ve kursiyer dosyanıza işlenmiştir. Teşekkür ederiz.\n\nSPRİNT YÜZME OKULU"},
  {key:"renewal", title:"Kayıt Yenileme", icon:"📌", text:"Değerli Velimiz, {ogrenci_adi} öğrencimizin yüzme eğitimine kesintisiz devam edebilmesi için kayıt yenileme işleminizi tamamlayabilirsiniz.\n\nSPRİNT YÜZME OKULU"},
  {key:"gift", title:"Hediye Ders", icon:"🎁", text:"SPRİNT YÜZME OKULU tarafından kursiyerimize hediye ders tanımlanmıştır. Hediye ders sisteminize işlenmiş ve planlanan bitiş tarihinize eklenmiştir."},
  {key:"general", title:"Genel Duyuru", icon:"📣", text:"Değerli Velimiz,\n\n{mesaj}\n\nSPRİNT YÜZME OKULU\n0551 896 83 19"},
];

function studentName(s:Student){ return `${s.first_name||""} ${s.last_name||""}`.trim(); }
function cleanPhone(v?:string|null){ return (v||"").replace(/\D/g,""); }

export default function MessageCenter({branches,groups,schedules,students,memberships}:Props){
  const [tab,setTab] = useState<"compose"|"templates"|"media"|"history"|"gift">("compose");
  const [branchId,setBranchId] = useState("");
  const [groupId,setGroupId] = useState("");
  const [scheduleId,setScheduleId] = useState("");
  const [selected,setSelected] = useState<string[]>([]);
  const [templateKey,setTemplateKey] = useState("registration");
  const [message,setMessage] = useState(templates[0].text);
  const [mediaUrl,setMediaUrl] = useState("");
  const [giftCount,setGiftCount] = useState(1);
  const [giftNote,setGiftNote] = useState("");
  const [result,setResult] = useState<any>(null);
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
  const selectedBranch = branches.find(b=>b.id===branchId);
  const selectedGroup = groups.find(g=>g.id===groupId);
  const selectedSchedule = schedules.find(s=>s.id===scheduleId);
  const programText = selectedSchedule ? `${DAYS[selectedSchedule.weekday]} ${selectedSchedule.start_time.slice(0,5)}-${selectedSchedule.end_time.slice(0,5)}` : visibleSchedules.map(s=>`${DAYS[s.weekday]} ${s.start_time.slice(0,5)}`).join(" / ") || "Program seçilmedi";

  const preview = message
    .replaceAll("{ogrenci_adi}", audience[0] ? studentName(audience[0]) : "Kursiyer Adı")
    .replaceAll("{sube}",selectedBranch?.name||"Şube")
    .replaceAll("{grup}",selectedGroup?.name||"Grup")
    .replaceAll("{program}",programText)
    .replaceAll("{mesaj}","Duyuru metniniz burada görüntülenir.");

  function chooseTemplate(key:string){
    const t=templates.find(x=>x.key===key); if(!t)return;
    setTemplateKey(key); setMessage(t.text); setTab("compose");
  }

  function toggleStudent(id:string){
    setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  }

  function sendWhatsApp(){
    const first = audience.find(s=>activeIds.includes(s.id));
    if(!first) return alert("Önce alıcı seçin.");
    const phone = cleanPhone(first.guardian_phone)||cleanPhone(first.phone);
    if(!phone) return alert("Seçilen ilk alıcının telefon numarası bulunamadı.");
    const text = encodeURIComponent(preview + (mediaUrl?`\n\n📎 Görsel: ${mediaUrl}`:""));
    window.open(`https://wa.me/${phone}?text=${text}`,"_blank");
  }

  function applyGift(){
    if(!groupId) return alert("Hediye ders için grup seçin.");
    startTransition(async()=>{
      const response = await addGiftLessons({studentIds:activeIds,lessonCount:giftCount,targetGroupId:groupId,targetScheduleId:scheduleId||null,note:giftNote});
      setResult(response);
    });
  }

  return <section className={styles.workspace}>
    <nav className={styles.tabs}>
      {[["compose","Yeni Toplu Mesaj"],["templates","Hazır Şablonlar"],["media","Afiş / Görsel"],["gift","Hediye Ders"],["history","Geçmiş"]].map(([key,label])=><button key={key} className={tab===key?styles.activeTab:""} onClick={()=>setTab(key as any)}>{label}</button>)}
    </nav>

    <div className={styles.grid}>
      <div className={styles.leftCol}>
        <div className={styles.card}>
          <div className={styles.cardHead}><div><span>1</span><h2>Alıcıları Belirle</h2></div><strong>{activeIds.length} kişi</strong></div>
          <div className={styles.filters}>
            <label>Şube<select value={branchId} onChange={e=>{setBranchId(e.target.value);setGroupId("");setScheduleId("");setSelected([]);}}><option value="">Tüm şubeler</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label>Grup<select value={groupId} onChange={e=>{setGroupId(e.target.value);setScheduleId("");setSelected([]);}}><option value="">Tüm gruplar</option>{visibleGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label>Seans<select value={scheduleId} onChange={e=>setScheduleId(e.target.value)}><option value="">Tüm seanslar</option>{visibleSchedules.map(s=><option key={s.id} value={s.id}>{DAYS[s.weekday]} {s.start_time.slice(0,5)}-{s.end_time.slice(0,5)}</option>)}</select></label>
          </div>
          <div className={styles.audienceHead}><span>Aktif kursiyerler</span><button onClick={()=>setSelected(audience.map(s=>s.id))}>Tümünü seç</button></div>
          <div className={styles.people}>
            {audience.slice(0,80).map(s=><label key={s.id} className={styles.person}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggleStudent(s.id)}/><div><b>{studentName(s)}</b><small>{s.guardian_phone||s.phone||"Telefon eksik"}</small></div></label>)}
            {!audience.length && <p className={styles.muted}>Bu filtrede aktif kursiyer bulunamadı.</p>}
          </div>
        </div>

        {tab==="templates" ? <div className={styles.card}><div className={styles.cardHead}><div><span>2</span><h2>Hazır Şablon Kütüphanesi</h2></div></div><div className={styles.templateGrid}>{templates.map(t=><button key={t.key} className={styles.templateCard} onClick={()=>chooseTemplate(t.key)}><i>{t.icon}</i><b>{t.title}</b><small>Şablonu aç ve düzenle</small></button>)}</div></div> : null}

        {tab==="gift" ? <div className={styles.card}><div className={styles.cardHead}><div><span>🎁</span><h2>SPRİNT Hediye Ders Merkezi</h2></div></div><div className={styles.giftBanner}><div className={styles.giftIcon}>🎁</div><div><b>Kursiyerinize özel hediye ders tanımlayın</b><p>Ders hakkı otomatik artar, planlanan bitiş tarihi seçilen grup/seans düzenine göre uzar ve kursiyer işlem geçmişine kaydedilir.</p></div></div><div className={styles.filters}><label>Hediye ders sayısı<select value={giftCount} onChange={e=>setGiftCount(Number(e.target.value))}>{[1,2,3,4,5,6,8,10,12].map(n=><option key={n} value={n}>{n} ders</option>)}</select></label><label className={styles.wide}>Özel not<input value={giftNote} onChange={e=>setGiftNote(e.target.value)} placeholder="Örn. Eylül dönemi özel hediyemiz"/></label></div><div className={styles.summaryBox}><span>Seçili kursiyer <b>{activeIds.length}</b></span><span>Grup <b>{selectedGroup?.name||"Seçilmedi"}</b></span><span>Seans <b>{programText}</b></span></div><button className={styles.primary} disabled={pending||!activeIds.length||!groupId} onClick={applyGift}>{pending?"Hediye dersler işleniyor…":`${activeIds.length} Kişiye Hediye Ders Ekle`}</button>{result&&<div className={result.ok?styles.success:styles.error}>{result.message}</div>}</div> : null}

        {tab!=="templates" && tab!=="gift" ? <div className={styles.card}>
          <div className={styles.cardHead}><div><span>2</span><h2>Mesaj İçeriği</h2></div></div>
          <div className={styles.quickTemplates}>{templates.slice(0,7).map(t=><button key={t.key} className={templateKey===t.key?styles.chipActive:""} onClick={()=>chooseTemplate(t.key)}>{t.icon} {t.title}</button>)}</div>
          <textarea className={styles.textarea} value={message} onChange={e=>setMessage(e.target.value)} rows={10}/>
          <div className={styles.variables}><b>Akıllı alanlar:</b> <code>{`{ogrenci_adi}`}</code> <code>{`{sube}`}</code> <code>{`{grup}`}</code> <code>{`{program}`}</code></div>
          <label className={styles.mediaField}>Afiş / görsel bağlantısı<input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} placeholder="https://... görsel bağlantısı"/></label>
        </div> : null}
      </div>

      <aside className={styles.previewCol}>
        <div className={styles.previewTitle}><span>WhatsApp önizlemesi</span><strong>{activeIds.length} alıcı</strong></div>
        <div className={styles.phone}>
          <div className={styles.phoneHead}><span>←</span><div className={styles.avatar}>S</div><div><b>SPRİNT YÜZME OKULU</b><small>WhatsApp Business</small></div></div>
          <div className={styles.chat}>
            {mediaUrl && <div className={styles.mediaPreview}><img src={mediaUrl} alt="Mesaj afişi"/><span>SPRİNT duyuru görseli</span></div>}
            <div className={styles.bubble}>{preview.split("\n").map((line,i)=><span key={i}>{line||" "}</span>)}<small>23:40 ✓✓</small></div>
          </div>
        </div>
        <div className={styles.sendBox}><div><b>Gönderime hazır</b><small>{activeIds.length} kişi · {selectedBranch?.name||"Tüm şubeler"}</small></div><button className={styles.whatsapp} onClick={sendWhatsApp}>WhatsApp'ta Aç</button></div>
        <p className={styles.note}>Toplu alıcı seçimi burada hazırlanır. WhatsApp penceresi ilk alıcıyla açılır; toplu gönderim API entegrasyonu eklendiğinde aynı liste doğrudan kuyruklanabilir.</p>
      </aside>
    </div>
  </section>;
}
