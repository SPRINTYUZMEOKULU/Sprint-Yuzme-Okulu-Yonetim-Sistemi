"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type PassiveCenterStudent={
  id:string;first_name:string;last_name:string;student_number:string|null;status:string;
  branch_id:string|null;branch_name:string|null;group_id:string|null;group_name:string|null;
  phone:string|null;guardian_phone:string|null;passive_reason:string|null;passive_description:string|null;
  passive_at:string|null;request_status:string|null;
};

type Props={students:PassiveCenterStudent[];canApprove:boolean};
const REASONS=["Kursa devam etmeyecek","Kayıt süresi sona erdi","Kursiyer / veli talebi","Şube veya şehir değişikliği","Sağlık / kişisel neden","Çift kayıt / mükerrer kayıt","Diğer"];
function fmtDate(v?:string|null){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d)}
function norm(v?:string|null){return String(v||"").toLocaleLowerCase("tr-TR")}

export default function PassiveCenterClient({students,canApprove}:Props){
  const router=useRouter();
  const [tab,setTab]=useState<"passive"|"deactivate">("passive");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [reason,setReason]=useState(REASONS[0]);
  const [description,setDescription]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const passive=useMemo(()=>students.filter(s=>s.status==="passive"),[students]);
  const active=useMemo(()=>students.filter(s=>s.status==="active"),[students]);
  const source=tab==="passive"?passive:active;
  const visible=useMemo(()=>{const q=norm(search).trim();if(!q)return source;return source.filter(s=>norm(`${s.first_name} ${s.last_name} ${s.student_number||""} ${s.branch_name||""} ${s.group_name||""} ${s.phone||""} ${s.guardian_phone||""} ${s.passive_reason||""}`).includes(q))},[source,search]);

  function toggle(id:string){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
  function toggleAll(){const ids=visible.map(x=>x.id);setSelected(v=>ids.length&&ids.every(id=>v.includes(id))?v.filter(id=>!ids.includes(id)):Array.from(new Set([...v,...ids])))}

  async function deactivate(){
    if(!selected.length){setMessage("En az bir öğrenci seçin.");return}
    if(!reason.trim()){setMessage("Pasife alma gerekçesi zorunludur.");return}
    if(!window.confirm(`${selected.length} öğrenci pasife alınacak. Devam etmek istiyor musunuz?`))return;
    setBusy(true);setMessage("");let approved=0,pending=0,failed=0;
    try{
      for(const id of selected){
        const student=active.find(s=>s.id===id);if(!student){failed++;continue}
        const createRes=await fetch("/api/student-status-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_type:"deactivate",student_id:id,branch_id:student.branch_id,group_id:student.group_id,reason,description,old_status:"active",new_status:"passive"})});
        const created=await createRes.json().catch(()=>({}));
        if(!createRes.ok||!created?.ok){failed++;continue}
        if(canApprove&&created?.request?.id){
          const approveRes=await fetch("/api/approval-center",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:created.request.id,source:"student_status",action:"approve",review_note:"Pasif Öğrenci Merkezi üzerinden yönetici tarafından onaylandı."})});
          const approvedResult=await approveRes.json().catch(()=>({}));
          if(approveRes.ok&&approvedResult?.ok)approved++;else pending++;
        }else pending++;
      }
      setMessage(`${approved?`${approved} öğrenci pasife alındı. `:""}${pending?`${pending} talep yönetici onayına gönderildi. `:""}${failed?`${failed} işlem tamamlanamadı.`:""}`.trim());
      setSelected([]);setDescription("");router.refresh();
    }catch{setMessage("İşlem sırasında bağlantı hatası oluştu.")}finally{setBusy(false)}
  }

  return <main className="pcPage">
    <header className="pcHero"><div><span>SPRİNTOS · ÖĞRENCİ DURUM YÖNETİMİ</span><h1>Pasif Öğrenci Merkezi</h1><p>Pasif öğrencileri, pasife alma gerekçelerini ve yeni pasife alma işlemlerini tek ekrandan yönetin.</p></div><Link href="/ogrenciler">Öğrenci Merkezine Dön</Link></header>

    <section className="pcStats">
      <button className={tab==="passive"?"active":""} onClick={()=>{setTab("passive");setSelected([])}}><span>Pasif Öğrenci</span><strong>{passive.length}</strong><small>Gerekçe ve geçmişi görüntüle</small></button>
      <button className={tab==="deactivate"?"active":""} onClick={()=>{setTab("deactivate");setSelected([])}}><span>Pasife Alınabilir Aktif</span><strong>{active.length}</strong><small>Tekli veya toplu işlem yap</small></button>
      <div><span>Seçili Öğrenci</span><strong>{selected.length}</strong><small>{tab==="deactivate"?"Pasife alma için seçildi":"Liste seçimi"}</small></div>
    </section>

    <section className="pcToolbar"><div className="pcSearch"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Öğrenci, numara, şube, grup veya gerekçe ara..."/></div>{tab==="deactivate"?<button className="selectAll" onClick={toggleAll}>{visible.length&&visible.every(s=>selected.includes(s.id))?"Seçimi Kaldır":"Görünenlerin Tümünü Seç"}</button>:null}</section>

    {tab==="deactivate"?<section className="bulkPanel"><div><span>TOPLU PASİFE ALMA</span><h2>{selected.length?`${selected.length} öğrenci için işlem hazır`:"Öğrencileri seçin"}</h2><p>Aynı gerekçeyi seçili tüm öğrencilere uygulayabilirsiniz. Yönetici hesabında işlem doğrudan onaylanır; diğer yetkilerde Onay Merkezi'ne gider.</p></div><div className="bulkFields"><label>Gerekçe<select value={reason} onChange={e=>setReason(e.target.value)}>{REASONS.map(x=><option key={x}>{x}</option>)}</select></label><label>Açıklama / Not<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="İsteğe bağlı detay..."/></label><button disabled={busy||!selected.length} onClick={deactivate}>{busy?"İşleniyor…":selected.length?`${selected.length} Öğrenciyi Pasife Al`:"Öğrenci Seçin"}</button></div>{message?<div className="resultMessage">{message}</div>:null}</section>:null}

    <section className="pcListHead"><div><strong>{visible.length}</strong><span>{tab==="passive"?"pasif öğrenci gösteriliyor":"aktif öğrenci pasife alınabilir"}</span></div></section>
    <section className="pcGrid">{visible.map(s=><article key={s.id} className={selected.includes(s.id)?"selected":""}>
      <header>{tab==="deactivate"?<label className="check" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggle(s.id)}/></label>:<span className="archiveIcon">▣</span>}<div><small>{s.student_number||"ÖĞRENCİ NO YOK"}</small><h3>{s.first_name} {s.last_name}</h3></div><b className={s.status==="passive"?"passiveBadge":"activeBadge"}>{s.status==="passive"?"Pasif":"Aktif"}</b></header>
      <div className="meta"><span>📍 {s.branch_name||"Şube yok"}</span><span>👥 {s.group_name||"Grup yok"}</span></div>
      {tab==="passive"?<div className="reasonBox"><span>PASİFE ALMA GEREKÇESİ</span><strong>{s.passive_reason||"Gerekçe kaydı bulunamadı"}</strong>{s.passive_description?<p>{s.passive_description}</p>:null}<small>Pasife alınma: {fmtDate(s.passive_at)}</small></div>:<div className="readyBox"><strong>Pasife alma işlemi için uygun</strong><small>Seçip yukarıdaki toplu işlem alanından gerekçe belirleyebilirsiniz.</small></div>}
      <footer><Link href={`/ogrenciler/${s.id}`}>Dosyayı Aç</Link>{tab==="deactivate"?<button onClick={()=>{setSelected([s.id]);window.scrollTo({top:0,behavior:"smooth"})}}>Bu Öğrenciyi Pasife Al</button>:null}</footer>
    </article>)}</section>
    {!visible.length?<div className="empty">Bu filtreye uygun öğrenci bulunamadı.</div>:null}

    <style jsx>{`
      .pcPage{min-height:100vh;background:#f4f7fb;padding:28px 32px 60px;color:#10284d;font-family:Arial,sans-serif}.pcHero{max-width:1380px;margin:0 auto 18px;padding:26px 28px;border-radius:24px;background:linear-gradient(135deg,#0b2d5e,#154a91);color:#fff;display:flex;justify-content:space-between;gap:20px;align-items:center;box-shadow:0 18px 40px rgba(16,40,77,.13)}.pcHero span{font-size:10px;letter-spacing:.14em;font-weight:900;color:#9dc6ff}.pcHero h1{font-size:30px;margin:7px 0}.pcHero p{margin:0;color:#dceaff;max-width:720px;font-size:13px;line-height:1.5}.pcHero a{background:#fff;color:#144a91;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:900;font-size:12px}.pcStats{max-width:1380px;margin:0 auto 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.pcStats>button,.pcStats>div{border:1px solid #dde6f1;background:#fff;border-radius:18px;padding:16px;text-align:left;display:grid;gap:4px}.pcStats button{cursor:pointer}.pcStats button.active{border-color:#2f80ed;box-shadow:0 0 0 3px rgba(47,128,237,.08)}.pcStats span{font-size:11px;color:#6f8097;font-weight:800}.pcStats strong{font-size:27px}.pcStats small{font-size:10px;color:#8b98aa}.pcToolbar{max-width:1380px;margin:0 auto 14px;padding:12px;background:#fff;border:1px solid #dde6f1;border-radius:16px;display:flex;gap:10px}.pcSearch{flex:1;display:flex;align-items:center;gap:8px;border:1px solid #d9e2ed;border-radius:12px;padding:0 12px}.pcSearch input{width:100%;height:42px;border:0;outline:0;background:transparent}.selectAll{border:0;border-radius:11px;background:#edf5ff;color:#1769d2;padding:0 14px;font-weight:900}.bulkPanel{max-width:1380px;margin:0 auto 16px;padding:20px;border:1px solid #cfe0f7;background:#fff;border-radius:20px;box-shadow:0 10px 28px rgba(16,40,77,.05)}.bulkPanel>div:first-child span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#1769d2}.bulkPanel h2{margin:5px 0 4px}.bulkPanel p{margin:0;color:#718198;font-size:12px}.bulkFields{display:grid;grid-template-columns:1fr 1.3fr auto;gap:12px;margin-top:16px;align-items:end}.bulkFields label{display:grid;gap:6px;font-size:11px;font-weight:800}.bulkFields select,.bulkFields textarea{border:1px solid #d7e1ed;border-radius:11px;padding:10px 11px;background:#fff}.bulkFields textarea{min-height:44px;resize:vertical}.bulkFields button{min-height:44px;border:0;border-radius:11px;background:#d92d20;color:#fff;font-weight:900;padding:0 18px}.bulkFields button:disabled{opacity:.45}.resultMessage{margin-top:12px;padding:11px 13px;border-radius:10px;background:#eef7ff;color:#24558b;font-size:12px;font-weight:800}.pcListHead{max-width:1380px;margin:0 auto 8px}.pcListHead>div{display:flex;gap:7px;align-items:baseline}.pcListHead strong{font-size:17px}.pcListHead span{font-size:11px;color:#7a889b}.pcGrid{max-width:1380px;margin:0 auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pcGrid article{background:#fff;border:1px solid #dde6f1;border-radius:18px;padding:16px;box-shadow:0 7px 20px rgba(16,40,77,.035)}.pcGrid article.selected{border-color:#2f80ed;box-shadow:0 0 0 3px rgba(47,128,237,.08)}.pcGrid header{display:flex;align-items:center;gap:11px}.check input{width:18px;height:18px}.archiveIcon{width:34px;height:34px;border-radius:10px;background:#fff1f0;color:#b42318;display:grid;place-items:center}.pcGrid header>div{flex:1}.pcGrid header small{font-size:9px;color:#2f80ed;font-weight:900;letter-spacing:.08em}.pcGrid h3{margin:4px 0 0;font-size:16px}.passiveBadge,.activeBadge{padding:6px 9px;border-radius:999px;font-size:10px}.passiveBadge{background:#fff1f0;color:#b42318}.activeBadge{background:#ecfdf3;color:#168254}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:13px 0;color:#61738c;font-size:11px}.meta span{background:#f6f8fb;padding:7px 9px;border-radius:9px}.reasonBox,.readyBox{border-radius:13px;padding:12px}.reasonBox{background:#fff8f6;border:1px solid #f5d3cc}.reasonBox span{display:block;font-size:9px;letter-spacing:.1em;color:#b42318;font-weight:900}.reasonBox strong{display:block;margin-top:5px;font-size:13px}.reasonBox p{margin:6px 0;color:#667085;font-size:11px;line-height:1.4}.reasonBox small,.readyBox small{display:block;margin-top:7px;color:#8793a5;font-size:10px}.readyBox{background:#f5f9ff;border:1px solid #dbe9fb}.readyBox strong{font-size:12px;color:#24558b}.pcGrid footer{display:flex;gap:8px;margin-top:12px}.pcGrid footer a,.pcGrid footer button{flex:1;min-height:38px;border-radius:10px;font-size:11px;font-weight:900;display:grid;place-items:center;text-decoration:none}.pcGrid footer a{border:1px solid #d7e1ed;color:#24558b}.pcGrid footer button{border:0;background:#fff1f0;color:#b42318}.empty{max-width:1380px;margin:20px auto;padding:40px;text-align:center;background:#fff;border:1px dashed #cfd9e6;border-radius:18px;color:#7c899b}@media(max-width:900px){.pcPage{padding:18px 12px 50px}.pcHero{align-items:flex-start;flex-direction:column}.pcStats,.pcGrid{grid-template-columns:1fr}.bulkFields{grid-template-columns:1fr}.pcToolbar{flex-direction:column}.selectAll{min-height:42px}}
    `}</style>
  </main>
}
