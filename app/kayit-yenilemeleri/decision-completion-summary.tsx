"use client";

import Link from "next/link";
import type { CenterItem, RenewalHistory } from "./renewal-status-center-client";

type Props={items:CenterItem[];history:RenewalHistory[]};
function fmt(v?:string|null){if(!v)return"—";const d=new Date(v.length===10?`${v}T12:00:00+03:00`:v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d)}

export default function DecisionCompletionSummary({items,history}:Props){
  const waiting=items.filter(x=>x.category==="action");
  const passive=items.filter(x=>x.status==="passive");
  const completed=history.length+passive.length;
  const total=waiting.length+completed;
  const rate=total?Math.round(completed/total*100):100;
  const recent=[
    ...history.slice(0,6).map(x=>({id:`r-${x.id}`,studentId:x.studentId,name:x.studentName,label:"Kayıt yenilendi",date:x.performedAt,kind:"renewed" as const})),
    ...passive.slice(0,6).map(x=>({id:`p-${x.id}`,studentId:x.id,name:x.name,label:"Pasife alındı",date:x.passiveAt,kind:"passive" as const})),
  ].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,8);
  return <section className="decisionSummary">
    <div className="head"><div><span>İŞLEM TAKİBİ</span><h2>Kayıt kararı ilerlemesi</h2><p>Kayıt yenileme ve pasife alma kararlarının tamamlanma durumunu buradan takip edin.</p></div><strong>{rate}% tamamlandı</strong></div>
    <div className="stats"><div><small>Bekleyen</small><b>{waiting.length}</b><em>Karar gerekiyor</em></div><div><small>Tamamlanan</small><b>{completed}</b><em>Sonucu kayıtlı</em></div><div><small>Yenilenen</small><b>{history.length}</b><em>Yeni dönem açıldı</em></div><div><small>Pasife Alınan</small><b>{passive.length}</b><em>Devam etmiyor</em></div></div>
    <div className="progress"><i style={{width:`${rate}%`}}/></div>
    <div className="caption">{total} takip kaydının {completed} tanesi tamamlandı, {waiting.length} tanesi bekliyor.</div>
    {recent.length?<details><summary>Son tamamlanan işlemleri göster <b>{completed}</b></summary><div className="recent">{recent.map(x=><article key={x.id}><div><span className={x.kind}>{x.kind==="renewed"?"↻":"✓"}</span><div><strong>{x.name}</strong><small>{x.label} · {fmt(x.date)}</small></div></div>{x.studentId?<Link href={`/ogrenciler/${x.studentId}`}>Dosya →</Link>:null}</article>)}</div></details>:null}
    <style jsx>{`.decisionSummary{max-width:1500px;margin:0 auto 16px;padding:20px;border:1px solid #d8e4ef;border-radius:22px;background:#fff;color:#10284d;box-shadow:0 8px 26px rgba(24,57,92,.06)}.head{display:flex;align-items:center;justify-content:space-between;gap:16px}.head span{font-size:10px;font-weight:900;letter-spacing:.14em;color:#1471ce}.head h2{margin:5px 0 3px;font-size:22px}.head p{margin:0;color:#74869c}.head>strong{font-size:18px;color:#1471ce;white-space:nowrap}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}.stats div{padding:13px 14px;border:1px solid #e0e8f1;border-radius:15px;background:#f8fbfe}.stats small,.stats b,.stats em{display:block}.stats small{font-size:11px;font-weight:800;color:#71849b}.stats b{font-size:25px;margin:2px 0;color:#12365e}.stats em{font-size:11px;font-style:normal;color:#8b9aab}.progress{height:8px;margin-top:15px;border-radius:99px;background:#e8eff6;overflow:hidden}.progress i{display:block;height:100%;border-radius:99px;background:#1b75d0}.caption{margin-top:7px;font-size:12px;color:#708299}.decisionSummary details{margin-top:14px;border-top:1px solid #e5ecf3;padding-top:12px}.decisionSummary summary{cursor:pointer;font-weight:800;color:#174d80}.decisionSummary summary b{margin-left:6px}.recent{display:grid;gap:8px;margin-top:10px}.recent article{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #e2eaf2;border-radius:13px}.recent article>div{display:flex;align-items:center;gap:10px}.recent article span{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:#e8f5ee;color:#167448;font-weight:900}.recent article span.renewed{background:#eaf3ff;color:#1466b8}.recent article strong,.recent article small{display:block}.recent article small{margin-top:2px;color:#7a8b9e}.recent article a{color:#1466b8;text-decoration:none;font-weight:800}@media(max-width:760px){.decisionSummary{margin:0 14px 14px;padding:16px}.head{align-items:flex-start}.head p{font-size:12px}.head>strong{font-size:14px}.stats{grid-template-columns:repeat(2,1fr)}.recent article{align-items:flex-start}.recent article a{white-space:nowrap}}`}</style>
  </section>
}
