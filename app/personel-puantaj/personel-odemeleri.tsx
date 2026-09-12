"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  staffId: string; staffName: string; title: string; payType: string; lessonCount: number; totalMinutes: number;
  baseAmount: number; adjustmentAmount: number; totalAmount: number; status: string; paidAmount: number;
  paymentMethod: string | null; paidAt: string | null; archivedAt: string | null; paymentNote: string | null;
};
type Data = { month: string; canDeleteArchive: boolean; rows: Row[]; summary: { total: number; paid: number; pending: number; archived: number } };

const statusLabel: Record<string,string> = { draft:"Devam Ediyor", awaiting_payment:"Ödeme Bekliyor", paid:"Ödendi", archived:"Arşivlendi" };
const payLabel: Record<string,string> = { per_lesson:"Ders başı", hourly:"Saatlik", monthly:"Aylık sabit", monthly_plus_lesson:"Sabit + ek ders" };
function money(value:number){ return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(value||0); }
function monthNow(){ const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit"}).formatToParts(new Date()); return `${p.find(x=>x.type==="year")?.value||"2026"}-${p.find(x=>x.type==="month")?.value||"01"}`; }

export default function PersonelOdemeleri(){
  const [month,setMonth]=useState(monthNow()); const [data,setData]=useState<Data|null>(null); const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null); const [error,setError]=useState<string|null>(null); const [message,setMessage]=useState<string|null>(null); const [showArchive,setShowArchive]=useState(false);
  const load=useCallback(async()=>{ setLoading(true); setError(null); try{ const res=await fetch(`/api/personel-puantaj/odemeler?month=${month}`,{cache:"no-store"}); const payload=await res.json(); if(!res.ok) throw new Error(payload?.error||"Ödeme verileri alınamadı."); setData(payload); }catch(e){setError(e instanceof Error?e.message:"Ödeme verileri alınamadı.");}finally{setLoading(false);}},[month]);
  useEffect(()=>{void load();},[load]);

  async function act(row:Row,action:"close_period"|"mark_paid"|"archive"|"delete_archive"){
    setBusy(`${row.staffId}:${action}`); setError(null); setMessage(null);
    try{
      let extra:Record<string,unknown>={};
      if(action==="close_period"){ const raw=window.prompt("Ek ödeme / kesinti tutarı (kesinti için eksi değer yazın):",String(row.adjustmentAmount||0)); if(raw===null)return; const adjustmentAmount=Number(raw.replace(",",".")); if(!Number.isFinite(adjustmentAmount))throw new Error("Geçerli bir tutar girin."); extra={adjustmentAmount}; }
      if(action==="mark_paid"){ const raw=window.prompt("Ödenen tutar:",String(row.totalAmount||0)); if(raw===null)return; const paidAmount=Number(raw.replace(",",".")); if(!Number.isFinite(paidAmount)||paidAmount<0)throw new Error("Geçerli ödeme tutarı girin."); const method=window.prompt("Ödeme yöntemi: banka / nakit / diğer","bank_transfer"); if(method===null)return; const paymentNote=window.prompt("Ödeme notu (isteğe bağlı):","")||""; extra={paidAmount,paymentMethod:method,paymentNote}; }
      if(action==="archive"&&!window.confirm(`${row.staffName} için bu dönemi arşive kaldırmak istiyor musunuz?`))return;
      if(action==="delete_archive"&&!window.confirm(`${row.staffName} için ${month} dönemine ait ARŞİVLENMİŞ ödeme kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misiniz?`))return;
      const res=await fetch("/api/personel-puantaj/odemeler",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,staffId:row.staffId,month,...extra})}); const payload=await res.json(); if(!res.ok)throw new Error(payload?.error||"İşlem tamamlanamadı.");
      setMessage(action==="close_period"?"Hakediş kesinleştirildi ve ödeme bekliyor.":action==="mark_paid"?"Ödeme yapıldı olarak kaydedildi.":action==="archive"?"Kayıt arşive kaldırıldı.":"Arşivlenmiş ödeme kaydı kalıcı olarak silindi."); await load();
    }catch(e){setError(e instanceof Error?e.message:"İşlem tamamlanamadı.");}finally{setBusy(null);}
  }

  const rows=useMemo(()=>(data?.rows||[]).filter(r=>showArchive?true:r.status!=="archived"),[data,showArchive]);
  return <section className="ppPanel ppPayments">
    <div className="ppPanelHead ppPaymentsHead"><div><p>PERSONEL GİDERLERİ</p><h2>Hakediş, ödeme ve arşiv</h2></div><div className="ppPaymentTools"><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/><label><input type="checkbox" checked={showArchive} onChange={e=>setShowArchive(e.target.checked)}/> Arşivi göster</label></div></div>
    {message?<div className="ppNotice success ppInnerNotice">{message}</div>:null}{error?<div className="ppNotice danger ppInnerNotice">{error}</div>:null}
    <div className="ppExpenseStats"><article><span>Toplam Personel Gideri</span><strong>{money(data?.summary.total||0)}</strong></article><article><span>Ödenen</span><strong>{money(data?.summary.paid||0)}</strong></article><article><span>Ödeme Bekleyen</span><strong>{money(data?.summary.pending||0)}</strong></article><article><span>Arşivlenen Ödeme</span><strong>{money(data?.summary.archived||0)}</strong></article></div>
    {loading&&!data?<div className="ppEmpty">Personel giderleri hazırlanıyor…</div>:<div className="ppPayrollTableWrap"><table className="ppPayrollTable ppPaymentTable"><thead><tr><th>Personel</th><th>Model</th><th>Ders / Süre</th><th>Hakediş</th><th>Ek/Kesinti</th><th>Net</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>{rows.map(row=><tr key={row.staffId}><td><strong>{row.staffName}</strong><small>{row.title}</small></td><td>{payLabel[row.payType]||row.payType}</td><td>{row.lessonCount} ders · {Math.floor(row.totalMinutes/60)} sa {row.totalMinutes%60} dk</td><td>{money(row.baseAmount)}</td><td>{money(row.adjustmentAmount)}</td><td><strong>{money(row.totalAmount)}</strong></td><td><span className={`ppPayStatus ${row.status}`}>{statusLabel[row.status]||row.status}</span>{row.paidAt?<small>{new Date(row.paidAt).toLocaleDateString("tr-TR")}</small>:null}</td><td><div className="ppPayActions">
      {row.status==="draft"?<button className="ppSecondaryAction" disabled={busy!==null} onClick={()=>void act(row,"close_period")}>{busy===`${row.staffId}:close_period`?"İşleniyor…":"Hakedişi Kesinleştir"}</button>:null}
      {row.status==="awaiting_payment"?<button className="ppPrimary" disabled={busy!==null} onClick={()=>void act(row,"mark_paid")}>{busy===`${row.staffId}:mark_paid`?"Kaydediliyor…":"Ödeme Yap"}</button>:null}
      {row.status==="paid"?<button className="ppArchiveAction" disabled={busy!==null} onClick={()=>void act(row,"archive")}>{busy===`${row.staffId}:archive`?"Arşivleniyor…":"Arşive Kaldır"}</button>:null}
      {row.status==="archived"?<><span className="ppDone">Tamamlandı</span>{data?.canDeleteArchive?<button className="ppDeleteAction" disabled={busy!==null} onClick={()=>void act(row,"delete_archive")}>{busy===`${row.staffId}:delete_archive`?"Siliniyor…":"Sil"}</button>:null}</>:null}
    </div></td></tr>)}{!rows.length?<tr><td colSpan={8}><div className="ppEmpty">Bu dönem için personel kaydı bulunmuyor.</div></td></tr>:null}</tbody></table></div>}
    <div className="ppInfo"><strong>Ödeme akışı</strong><p>Ay boyunca hakediş canlı hesaplanır. Hakediş kesinleştirilir, ödeme kaydedilir ve istenirse arşive kaldırılır. Arşivdeki “Sil” yalnızca kurucu yönetici/yöneticiye görünür ve seçilen aylık ödeme kaydını kalıcı olarak siler; personel ve puantaj kayıtlarını silmez.</p></div>
  </section>;
}
