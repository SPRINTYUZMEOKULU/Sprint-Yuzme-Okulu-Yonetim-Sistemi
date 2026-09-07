"use client";

import { deleteGuardianPortalAccount } from "./delete-actions";

export default function DeleteGuardianButton({ guardianId, name }: { guardianId: string; name: string }) {
  return <form action={deleteGuardianPortalAccount} onSubmit={(e) => {
    const ok = window.confirm(`${name || "Bu hesap"} portal hesabı silinsin mi?\n\nÖğrenci kaydı silinmez. Sadece portal hesabı ve öğrenci bağlantıları kaldırılır.`);
    if (!ok) e.preventDefault();
  }}>
    <input type="hidden" name="guardian_profile_id" value={guardianId}/>
    <button type="submit" className="guardianDeleteButton">Hesabı Sil</button>
  </form>;
}
