"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type CenterItem={
  id:string;studentNumber:string|null;name:string;status:"active"|"passive";branchName:string|null;groupName:string|null;
  totalLessons:number;usedLessons:number;remainingLessons:number;plannedEndDate:string|null;reason:string;category:"action"|"soon"|"active"|"passive";
  passiveRequestPending:boolean;passiveReason:string|null;passiveAt:string|null;lastRenewedAt:string|null;
};
export type RenewalHistory={id:string;studentId:string|null;studentName:string;lessonCount:number|null;performedAt:string|null;description:string|null};

type Props={items:CenterItem[];history:RenewalHistory[];canApprove:boolean};
type Tab="action"|"soon"|"passive"|"renewed"|"all";

function fmt(value?:string|null){if(!value)return"—";const d=new Date(value.length===10?`${value}T12:00:00`:value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d)}
function norm(v?:string|null){return String(v||"").toLocaleLowerCase("tr-TR")}

export default function RenewalStatusCenterClient({items,history,canApprove}:Props){
  const router=useRouter();
  const [tab,setTab]=useState<Tab>("action");
  const [search,setSearch]=useState("");
  const [branch,setBranch]=useState("all");
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState<"passive"|"active"|null>(null);
  const [message,setMessage]=useState("");

  const branches=useMemo(()=>Array.from(new Set(items.map(x=>x.branchName).filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,"tr")),[items]);
  const actionCount=items.filter(x=>x.category==="action").length;
  const soonCount=items.filter(x=>x.category==="soon").length;
  const passiveCount=items.filter(x=>x.status==="passive").length;

  const visible=useMemo(()=>{
    if(tab==="renewed")return [];
    const q=norm(search).trim();
    return items.filter(x=>{
      const tabOk=tab==="all"?true:tab==="passive"?x.status==="passive":x.category===tab;
      const branchOk=branch==="all"||x.branchName===branch;
      const searchOk=!q||norm(`${x.name} ${x.studentNumber||""} ${x.branchName||""} ${x.groupName||""} ${x.reason||""}`).includes(q);
      return tabOk&&branchOk&&searchOk;
    });
  },[items,tab,branch,search]);

  const visibleIds=visible.map(x=>x.id);
  const allVisibleSelected=visibleIds.length>0&&visibleIds.every(id=>selected.includes(id));
  function toggle(id:string){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
  function toggleAll(){setSelected(v=>allVisibleSelected?v.filter(id=>!visibleIds.includes(id)):Array.from(new Set([...v,...visibleIds])))}
  function changeTab(next:Tab){setTab(next);setSelected([]);setMessage("")}

  async function statusAction(kind:"active"|"passive"){
    const source=selected.map(id=>items.find(x=>x.id===id)).filter(Boolean) as CenterItem[];
    const targets=source.filter(x=>kind==="passive"?x.status==="active":x.status==="passive");
    if(!targets.length){setMessage(kind==="passive"?"Pasife alınabilecek aktif öğrenci seçin.":"Aktife alınabilecek pasif öğrenci seçin.");return}
    const label=kind==="passive"?"pasife alınacak":"yeniden aktif duruma alınacak";
    if(!window.confirm(`${targets.length} öğrenci ${label}. Geçmiş kayıtlar korunacaktır. Devam edilsin mi?`))return;
    setBusy(kind);setMessage("");let done=0,pending=0,failed=0;
    try{
      for(const student of targets){
        const requestType=kind==="active"?"activate":"deactivate";
        const createRes=await fetch("/api/student-status-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_type:requestType,student_id:student.id,reason:kind==="active"?"Kursiyer yeniden kursa başladı":"Kayıt yenilenmedi / kursa devam etmeyecek",description:"Kayıt Yenileme ve Durum Merkezi toplu işlemi",old_status:kind==="active"?"passive":"active",new_status:kind})});
        const created=await createRes.json().catch(()=>({}));
        if(!createRes.ok||!created?.ok){failed++;continue}
        if(canApprove&&created?.request?.id){
          const approveRes=await fetch("/api/approval-center",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:created.request.id,source:"student_status",action:"approve",review_note:"Kayıt Yenileme ve Durum Merkezi üzerinden yönetici tarafından onaylandı."})});
          const approved=await approveRes.json().catch(()=>({}));
          if(approveRes.ok&&approved?.ok)done++;else pending++;
        }else pending++;
      }
      setMessage(`${done?`${done} öğrenci güncellendi. `:""}${pending?`${pending} işlem yönetici onayına gönderildi. `:""}${failed?`${failed} işlem tamamlanamadı.`:""}`.trim());
      setSelected([]);router.refresh();
    }catch{setMessage("Toplu işlem sırasında bağlantı hatası oluştu.")}finally{setBusy(null)}
  }

  function startBulkRenewal(){
    const ids=selected.filter(id=>items.find(x=>x.id===id)?.status==="active");
    if(!ids.length){setMessage("Kayıt yenilemek için en az bir aktif öğrenci seçin.");return}
    try{window.sessionStorage.setItem("sprint:bulk-renewal-queue",JSON.stringify(ids))}catch{}
    if(ids.length>1)setMessage(`${ids.length} öğrenci yenileme sırasına alındı. İlk öğrencinin yenileme ekranı açılıyor.`);
    router.push(`/ogrenciler/${ids[0]}?renewal=1&bulkRenewal=1`);
  }

  return <main className="centerPage">
    <section className="hero">
      <div><span>SPRİNTOS · KAYIT VE DURUM OPERASYONU</span><h1>Kayıt Yenileme ve Durum Merkezi</h1><p>Kayıt kararı, yenileme, pasife alma ve yeniden aktifleştirme işlemlerini tek ekrandan yönetin. Öğrenci geçmişi korunur.</p></div>
      <div className="heroActions"><Link href="/ogrenciler">Öğrenci Merkezi</Link><Link href="/onay-merkezi" className="primary">Onay Merkezi</Link></div>
    </section>

    <section className="stats">
      <button className={tab==="action"?"selected":""} onClick={()=>changeTab("action")}><span>İşlem Bekleyen</span><strong>{actionCount}</strong><small>Ders hakkı veya kayıt dönemi bitti</small></button>
      <button className={tab==="soon"?"selected":""} onClick={()=>changeTab("soon")}><span>Yenilemesi Yaklaşan</span><strong>{soonCount}</strong><small>3 ders ve altı / tarih yaklaşıyor</small></button>
      <button className={tab==="passive"?"selected":""} onClick={()=>changeTab("passive")}><span>Pasif Öğrenciler</span><strong>{passiveCount}</strong><small>Tekrar aktife alınabilir</small></button>
      <button className={tab==="renewed"?"selected":""} onClick={()=>changeTab("renewed")}><span>Yenilenenler</span><strong>{history.length}</strong><small>Yenileme geçmişi</small></button>
      <button className={tab==="all"?"selected":""} onClick={()=>changeTab("all")}><span>Tüm Kayıtlar</span><strong>{items.length}</strong><small>Aktif + pasif</small></button>
    </section>

    {tab!=="renewed"?<>
      <section className="toolbar">
        <div className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Öğrenci, numara, şube, grup veya durum ara..."/></div>
        <select value={branch} onChange={e=>setBranch(e.target.value)}><option value="all">Tüm şubeler</option>{branches.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <button className="refresh" onClick={()=>router.refresh()}>↻ Yenile</button>
      </section>

      <section className={`bulkBar ${selected.length?"show":""}`}>
        <div><strong>{selected.length}</strong><span> öğrenci seçildi</span></div>
        <div className="bulkActions">
          <button onClick={toggleAll}>{allVisibleSelected?"Seçimi Kaldır":"Görünenleri Seç"}</button>
          <button className="renew" disabled={!selected.length} onClick={startBulkRenewal}>↻ Toplu Kayıt Yenile</button>
          <button className="activate" disabled={!selected.length||busy!==null} onClick={()=>statusAction("active")}>{busy==="active"?"İşleniyor…":"✓ Aktife Al"}</button>
          <button className="passive" disabled={!selected.length||busy!==null} onClick={()=>statusAction("passive")}>{busy==="passive"?"İşleniyor…":"⊘ Pasife Al"}</button>
          <button onClick={()=>setSelected([])}>Temizle</button>
        </div>
      </section>
      {message?<div className="message">{message}</div>:null}

      <section className="listHead"><div><strong>{visible.length}</strong><span> kayıt gösteriliyor</span></div><button onClick={toggleAll}>{allVisibleSelected?"Görünen seçimi kaldır":"Görünenlerin tümünü seç"}</button></section>
      <section className="grid">{visible.map((item,i)=><article key={item.id} className={selected.includes(item.id)?"card selectedCard":"card"}>
        <label className="check"><input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggle(item.id)}/><span/></label><div className="num">#{i+1}</div>
        <div className="head"><div><small>{item.studentNumber||"ÖĞRENCİ NO YOK"}</small><h2>{item.name}</h2><p>{item.branchName||"Şube yok"} · {item.groupName||"Grup yok"}</p></div><b className={`badge ${item.status}`}>{item.status==="passive"?"Pasif":item.reason}</b></div>
        <div className="facts"><div><span>Toplam Ders</span><strong>{item.totalLessons||"—"}</strong></div><div><span>Kullanılan</span><strong>{item.usedLessons}</strong></div><div><span>Kalan Ders</span><strong>{item.remainingLessons}</strong></div><div><span>Bitiş Tarihi</span><strong>{fmt(item.plannedEndDate)}</strong></div></div>
        {item.status==="passive"?<div className="notice passiveNotice"><strong>Pasife alma nedeni</strong><span>{item.passiveReason||"Gerekçe kaydı yok"}{item.passiveAt?` · ${fmt(item.passiveAt)}`:""}</span></div>:<div className="notice"><strong>{item.reason}</strong><span>{item.category==="action"?"Devam edecekse kayıt yenilenmeli; devam etmeyecekse pasife alınmalıdır.":"Kayıt bitişi yaklaşıyor. Yenileme için hazırlık yapılabilir."}</span></div>}
        <footer>
          {item.status==="active"?<Link className="renewBtn" href={`/ogrenciler/${item.id}?renewal=1`}>↻ <span>Kayıt Yenile</span></Link>:<button className="activateBtn" onClick={()=>{setSelected([item.id]);void statusAction("active")}}>✓ <span>Aktife Al</span></button>}
          {item.status==="active"?<button className="passiveBtn" onClick={()=>{setSelected([item.id]);void statusAction("passive")}}>{item.passiveRequestPending?"Onay Bekliyor":"⊘ Pasife Al"}</button>:null}
          <Link className="fileBtn" href={`/ogrenciler/${item.id}`}>▣ <span>Dosyayı Aç</span></Link>
        </footer>
      </article>)}</section>
      {!visible.length?<div className="empty">Bu filtreye uygun kursiyer bulunamadı.</div>:null}
    </>:<section className="historyPanel"><div className="historyHead"><div><span>YENİLEME GEÇMİŞİ</span><h2>Tamamlanan kayıt yenilemeleri</h2></div><strong>{history.length} kayıt</strong></div><div className="historyTable"><table><thead><tr><th>Öğrenci</th><th>Ders</th><th>Yenileme Tarihi</th><th>Açıklama</th><th>İşlem</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td><strong>{row.studentName}</strong></td><td>{row.lessonCount?`${row.lessonCount} ders`:"—"}</td><td>{fmt(row.performedAt)}</td><td>{row.description||"Kayıt yenilendi"}</td><td>{row.studentId?<Link href={`/ogrenciler/${row.studentId}`}>Dosyayı Aç →</Link>:"—"}</td></tr>)}</tbody></table></div>{!history.length?<div className="empty">Henüz tamamlanmış kayıt yenilemesi bulunmuyor.</div>:null}</section>}

    <style jsx>{`
      .centerPage{min-height:100vh;background:linear-gradient(180deg,#f4f7fb,#edf3f9);padding:24px 28px 60px;color:#10284d;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.hero{max-width:1500px;margin:0 auto 16px;padding:25px 27px;border-radius:24px;background:linear-gradient(135deg,#08274f,#1260a5);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:20px;box-shadow:0 18px 42px rgba(12,45,80,.17)}.hero span,.historyHead span{font-size:10px;letter-spacing:.13em;font-weight:950;color:#ffb44d}.hero h1{font-size:30px;margin:6px 0}.hero p{margin:0;max-width:800px;color:#dbeafa;font-size:13px;line-height:1.5}.heroActions{display:flex;gap:8px;flex-wrap:wrap}.heroActions a{min-height:42px;padding:0 14px;border:1px solid rgba(255,255,255,.24);border-radius:12px;display:inline-flex;align-items:center;color:#fff;text-decoration:none;font-size:12px;font-weight:900}.heroActions .primary{background:#fff;color:#15548c}.stats{max-width:1500px;margin:0 auto 14px;display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.stats button{border:1px solid #dce6f0;background:#fff;border-radius:16px;padding:14px;text-align:left;display:grid;gap:3px;box-shadow:0 8px 22px rgba(20,45,75,.04);cursor:pointer}.stats button.selected{border-color:#2f80ed;box-shadow:0 0 0 3px rgba(47,128,237,.09)}.stats span{font-size:10px;color:#718198;font-weight:900}.stats strong{font-size:25px;color:#123f6d}.stats small{font-size:9px;color:#92a0b1}.toolbar{max-width:1500px;margin:0 auto 10px;background:#fff;border:1px solid #dce6f0;border-radius:15px;padding:10px;display:flex;gap:8px}.search{flex:1;border:1px solid #d6e0eb;border-radius:11px;display:flex;align-items:center;gap:8px;padding:0 11px}.search input{width:100%;height:42px;border:0;outline:0;background:transparent}.toolbar select,.refresh{min-height:42px;border:1px solid #d6e0eb;border-radius:11px;background:#fff;padding:0 12px;color:#34556f;font-weight:800}.refresh{background:#1269d3;color:#fff;border:0}.bulkBar{max-width:1500px;margin:0 auto 10px;padding:0;max-height:0;overflow:hidden;opacity:0;transition:.2s}.bulkBar.show{max-height:140px;opacity:1;padding:11px 12px;background:#0f2f55;border-radius:15px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px}.bulkBar strong{font-size:18px}.bulkActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.bulkActions button{min-height:38px;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:0 11px;background:rgba(255,255,255,.08);color:#fff;font-weight:900;font-size:11px}.bulkActions .renew{background:#1473e6}.bulkActions .activate{background:#168254}.bulkActions .passive{background:#b42318}.bulkActions button:disabled{opacity:.45}.message{max-width:1500px;margin:0 auto 10px;padding:11px 13px;border-radius:11px;background:#eef7ff;color:#24558b;font-size:12px;font-weight:800}.listHead{max-width:1500px;margin:0 auto 8px;display:flex;align-items:center;justify-content:space-between}.listHead strong{font-size:17px}.listHead span{font-size:11px;color:#75869a}.listHead button{border:0;background:transparent;color:#1769d2;font-weight:900;font-size:11px}.grid{max-width:1500px;margin:0 auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{position:relative;background:#fff;border:1px solid #dce6f0;border-radius:19px;padding:18px;box-shadow:0 8px 23px rgba(16,40,77,.04)}.selectedCard{border-color:#2f80ed;box-shadow:0 0 0 3px rgba(47,128,237,.09)}.check{position:absolute;left:16px;top:16px}.check input{width:18px;height:18px;accent-color:#1769d2}.num{position:absolute;right:15px;top:14px;color:#99a8b9;font-size:10px}.head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding-left:28px}.head small{font-size:9px;color:#2f80ed;font-weight:950;letter-spacing:.08em}.head h2{margin:4px 0 2px;font-size:19px}.head p{margin:0;color:#7a899c;font-size:10px}.badge{margin-right:30px;border-radius:999px;padding:7px 9px;font-size:10px;white-space:nowrap}.badge.active{background:#fff4dc;color:#8c5b00}.badge.passive{background:#fff1f0;color:#b42318}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.facts div{background:#f7f9fc;border-radius:11px;padding:10px;display:grid;gap:4px}.facts span{font-size:9px;color:#7c8a9c}.facts strong{font-size:13px}.notice{margin-top:12px;background:#fffaf0;border:1px solid #f4d59b;border-radius:12px;padding:11px;display:grid;gap:3px}.notice strong{font-size:11px}.notice span{color:#715727;font-size:11px;line-height:1.4}.passiveNotice{background:#fff7f5;border-color:#f1cec7}.passiveNotice span{color:#8d4138}.card footer{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px}.card footer a,.card footer button{min-height:42px;border-radius:11px;text-decoration:none;font-size:11px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid transparent}.renewBtn{background:#1769e0;color:#fff}.passiveBtn{background:#fff1f0;color:#b42318!important;border-color:#efc0bb!important}.activateBtn{background:#ecfdf3;color:#168254!important;border-color:#b8e7ca!important}.fileBtn{background:#f2f5f9;color:#355b7d}.empty{max-width:1500px;margin:14px auto;padding:24px;text-align:center;background:#fff;border:1px solid #dde6f1;border-radius:16px;color:#6c7c91}.historyPanel{max-width:1500px;margin:0 auto;padding:20px;background:#fff;border:1px solid #dce6f0;border-radius:20px}.historyHead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.historyHead h2{margin:5px 0 0}.historyHead>strong{background:#eef5ff;color:#15568f;padding:7px 10px;border-radius:999px;font-size:10px}.historyTable{overflow-x:auto}.historyTable table{width:100%;border-collapse:collapse;min-width:760px}.historyTable th,.historyTable td{padding:12px 10px;border-bottom:1px solid #e5edf4;text-align:left;font-size:12px}.historyTable th{color:#708195;font-size:10px}.historyTable a{color:#0b65aa;text-decoration:none;font-weight:900}
      @media(max-width:980px){.stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.bulkBar.show{align-items:flex-start;flex-direction:column}.bulkActions{justify-content:flex-start}}
      @media(max-width:620px){.centerPage{padding:14px 10px 50px}.hero{align-items:flex-start;flex-direction:column;padding:20px}.hero h1{font-size:24px}.heroActions{width:100%}.heroActions a{flex:1}.stats{grid-template-columns:1fr 1fr;gap:8px}.toolbar{flex-wrap:wrap}.search{flex-basis:100%}.toolbar select{flex:1}.facts{grid-template-columns:repeat(2,1fr)}.card{padding:16px 12px}.head{padding-left:27px}.head h2{font-size:17px}.badge{margin-right:24px}.card footer{grid-template-columns:1fr 1fr}.card footer .fileBtn{grid-column:1/-1}.bulkActions{display:grid;grid-template-columns:1fr 1fr;width:100%}.bulkActions button{min-height:42px}.historyPanel{padding:14px}}
    `}</style>
  </main>
}
