"use client";
import {useState} from "react";
type Field={label:string;value:string;sensitive?:boolean};
export default function PortalCopyFields({fields}:{fields:Field[]}){
 const [copied,setCopied]=useState("");
 const [sensitiveShown,setSensitiveShown]=useState(false);
 const [error,setError]=useState("");
 async function copy(value:string,label:string){
  try{await navigator.clipboard.writeText(value);setCopied(label);setError("");}
  catch{setError("Tarayıcı kopyalamaya izin vermedi. Değeri seçerek manuel kopyalayın.");}
 }
 return <section className="handoff-card">
  <h2>Doğrulanmış alıcı ve tahsilat bilgileri</h2>
  <p>Her alanı NetteFatura'daki karşılığına kopyalayın. Gizli kimlik alanları başlangıçta maskelidir. Portal doldurulmaz ve kesim yapılmaz.</p>
  <button type="button" className="handoff-toggle" onClick={()=>setSensitiveShown(v=>!v)}>
   {sensitiveShown?"Kimlik bilgilerini gizle":"Kimlik bilgilerini göster"}
  </button>
  <div className="handoff-field-grid">{fields.map(f=><div className="handoff-field" key={f.label}>
   <span className="handoff-label">{f.label}</span>
   <span className="handoff-value">{f.sensitive&&!sensitiveShown?"••••••••••":f.value}</span>
   <button type="button" disabled={!!f.sensitive&&!sensitiveShown} onClick={()=>copy(f.value,f.label)}>
    {copied===f.label?"Kopyalandı":"Kopyala"}
   </button>
  </div>)}</div>
  {error?<p role="alert">{error}</p>:null}
  <p className="handoff-warning"><strong>Kişisel veri güvenliği:</strong> Kopyalanan TCKN ve iletişim bilgileri cihazınızın panosunda kalabilir. Yalnız yetkili işletme hesabında kullanın.</p>
 </section>;
}
