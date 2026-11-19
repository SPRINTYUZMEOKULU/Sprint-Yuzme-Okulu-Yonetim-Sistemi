"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveEsmmPreparation } from "./esmm-approval-actions";

export default function EsmmApproval({requestId}:{requestId:string}) {
  const [checked,setChecked] = useState(false);
  const [pending,startTransition] = useTransition();
  const [message,setMessage] = useState("");
  const router=useRouter();
  return <div className="esmm-approval">
    <label style={{display:"flex",alignItems:"flex-start",gap:10,margin:"10px 0"}}>
      <input type="checkbox" checked={checked} disabled={pending} onChange={e=>setChecked(e.target.checked)} style={{width:19,marginTop:3,flexShrink:0}}/>
      <span>Alıcı ve havale/EFT tahsilatını kontrol ettim. Bu işlem <strong>yalnızca ön onay</strong> kaydeder; İşNet üzerinden e-SMM kesmez.</span>
    </label>
    <button type="button" disabled={!checked||pending} onClick={()=>startTransition(async()=>{
      try {const r=await approveEsmmPreparation(requestId);setMessage(r.message);if(r.ok){setChecked(false);router.refresh();}}
      catch {setMessage("İşlem doğrulanamadı; bir belge gönderilmedi.");}
    })}>{pending?"Kaydediliyor…":"e-SMM ön onayını kaydet"}</button>
    {message?<p role="status">{message}</p>:null}
  </div>;
}
