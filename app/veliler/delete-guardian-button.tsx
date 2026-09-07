"use client";

import { deleteGuardianPortalAccount } from "./delete-actions";

export default function DeleteGuardianButton({ guardianId, name }: { guardianId: string; name: string }) {
  return <form action={deleteGuardianPortalAccount} onSubmit={(e) => {
    const ok = window.confirm(`${name || "Bu hesap"} portal hesabı silinsin mi?\n\nÖğrenci kaydı silinmez. Sadece portal hesabı ve öğrenci bağlantıları kaldırılır.`);
    if (!ok) e.preventDefault();
  }} style={{flex:"1 1 100%"}}>
    <input type="hidden" name="guardian_profile_id" value={guardianId}/>
    <button type="submit" style={{width:"100%",minHeight:44,border:"1px solid #fecaca",borderRadius:11,background:"#fff1f2",color:"#b4232d",fontWeight:900,cursor:"pointer"}}>Hesabı Sil</button>
  </form>;
}
