"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type ArchiveItem = { id:string; student_id:string; reason:string|null; requested_at:string|null; created_at:string|null; student:{id:string;first_name:string|null;last_name:string|null;status:string|null;branch_id:string|null}|null };
function studentName(item:ArchiveItem){const name=`${item.student?.first_name||""} ${item.student?.last_name||""}`.trim();return name||`Öğrenci · ${item.student_id.slice(0,8)}`}

export default function ApprovedArchiveFinalizer(){
  const searchParams=useSearchParams();
  const focusedId=searchParams.get("archiveRequestId")||"";
  const explicitlyOpen=searchParams.get("permanentDelete")==="1";
  const [items,setItems]=useState<ArchiveItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(explicitlyOpen);
  const [processing,setProcessing]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function load(){setLoading(true);setError("");try{const response=await fetch("/api/student-status-requests/finalize",{cache:"no-store"});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.details||data.error||"Onaylı pasif kayıtlar alınamadı.");setItems(data.items||[])}catch(err){setError(err instanceof Error?err.message:"Onaylı pasif kayıtlar alınamadı.")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);
  const focused=useMemo(()=>items.find(item=>item.id===focusedId)||null,[items,focusedId]);

  async function remove(ids:string[],all=false){const selected=all?items:items.filter(item=>ids.includes(item.id));if(!selected.length)return;const names=selected.slice(0,4).map(studentName).join(", ");const extra=selected.length>4?` ve ${selected.length-4} öğrenci daha`:"";if(!window.confirm(`KALICI SİLME ONAYI\n\n${names}${extra}\n\nBu işlem öğrenci kaydını ve bağlı kayıtları kalıcı olarak kaldırabilir. İşlem geri alınamaz. Devam etmek istiyor musunuz?`))return;setProcessing(all?"all":ids[0]);setMessage("");setError("");try{const response=await fetch("/api/student-status-requests/finalize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(all?{all:true}:{ids})});const data=await response.json();if(!response.ok&&response.status!==207)throw new Error(data.details||data.error||"Kalıcı silme tamamlanamadı.");setMessage(data.message||"Kalıcı silme işlemi tamamlandı.");if(Array.isArray(data.failed)&&data.failed.length)setError(data.failed.map((row:any)=>row.error).join(" · "));await load()}catch(err){setError(err instanceof Error?err.message:"Kalıcı silme tamamlanamadı.")}finally{setProcessing("")}}

  if(loading)return null;
  if(!items.length&&!message&&!error)return null;

  return <section className="archiveFinalizer">
    <div className="archiveLauncher">
      <div className="archiveLauncherCopy"><span className="dangerDot"/><div><strong>Kalıcı Silme İşlemleri</strong><small>{items.length?`${items.length} onaylanmış pasif kayıt bekliyor`:"Bekleyen kayıt yok"}</small></div></div>
      <button type="button" className="archiveToggle" onClick={()=>setOpen(v=>!v)}>{open?"Kalıcı Silmeyi Kapat":"Kalıcı Silmeyi Aç"}</button>
    </div>
    {open?<div className="archivePanel">
      <div className="archiveHead"><div><span>YÖNETİCİ İŞLEMİ</span><h2>Onaylı Pasif Kayıtları Kalıcı Sil</h2><p>Bu alan yalnızca kalıcı silme gerektiğinde açılır. Normal Onay Merkezi işlemlerinden ayrıdır.</p></div>{items.length?<button type="button" className="bulkDelete" disabled={processing==="all"} onClick={()=>void remove([],true)}>{processing==="all"?"Siliniyor…":`${items.length} Kaydı Toplu Kalıcı Sil`}</button>:null}</div>
      {focusedId&&!focused?<div className="archiveInfo">Bildirimdeki kayıt artık listede yok. Daha önce kalıcı olarak silinmiş olabilir.</div>:null}{message?<div className="archiveSuccess">{message}</div>:null}{error?<div className="archiveError">{error}</div>:null}
      <div className="archiveList">{items.map(item=><article key={item.id} className={item.id===focusedId?"focused":""}><div><strong>{studentName(item)}</strong><span>Onaylandı · Pasif</span><small>{item.reason||"Arşivleme / pasife alma onayı"}</small></div><button type="button" disabled={Boolean(processing)} onClick={()=>void remove([item.id])}>{processing===item.id?"Kalıcı Siliniyor…":"Kalıcı Sil"}</button></article>)}</div>
    </div>:null}
    <style jsx>{`.archiveFinalizer{width:min(1236px,calc(100% - 44px));margin:16px auto 0;font-family:Arial,sans-serif}.archiveLauncher{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 6px 18px rgba(15,35,65,.035)}.archiveLauncherCopy{display:flex;align-items:center;gap:11px}.archiveLauncherCopy>div{display:grid;gap:2px}.archiveLauncher strong{font-size:13px;color:#17345b}.archiveLauncher small{font-size:11px;color:#73839a}.dangerDot{width:9px;height:9px;border-radius:50%;background:#d92d20;box-shadow:0 0 0 5px #fff1f0}.archiveToggle{min-height:36px;padding:0 13px;border:1px solid #efc2c7;border-radius:10px;background:#fff;color:#b4233a;font-size:12px;font-weight:900;cursor:pointer}.archivePanel{margin-top:10px;padding:18px;border:1px solid #f0c7ce;border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(15,35,65,.05)}.archiveHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.archiveHead span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#c8103d}.archiveHead h2{margin:5px 0;color:#17345b;font-size:20px}.archiveHead p{margin:0;color:#667085;font-size:13px;line-height:1.5}.bulkDelete,.archiveList button{border:0;border-radius:10px;background:#c8103d;color:#fff;font-weight:900;padding:11px 14px;cursor:pointer}.bulkDelete:disabled,.archiveList button:disabled{opacity:.55}.archiveList{display:grid;gap:8px;margin-top:14px}.archiveList article{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 13px;border:1px solid #e5eaf1;border-radius:12px;background:#f9fbfd}.archiveList article.focused{border-color:#2f80ed;box-shadow:0 0 0 3px rgba(47,128,237,.1)}.archiveList article>div{display:grid;gap:3px}.archiveList strong{color:#17345b;font-size:13px}.archiveList span{color:#17623b;font-size:11px;font-weight:900}.archiveList small{color:#667085;font-size:11px}.archiveInfo,.archiveSuccess,.archiveError{margin-top:12px;padding:11px 13px;border-radius:10px;font-size:12px;font-weight:800}.archiveInfo{background:#eef5ff;color:#24558b}.archiveSuccess{background:#eefaf4;color:#17623b}.archiveError{background:#fff0f0;color:#a22727}@media(max-width:720px){.archiveFinalizer{width:calc(100% - 24px)}.archiveLauncher,.archiveHead,.archiveList article{flex-direction:column;align-items:stretch}.archiveToggle,.bulkDelete,.archiveList button{width:100%}.archivePanel{padding:14px}}`}</style>
  </section>
}
