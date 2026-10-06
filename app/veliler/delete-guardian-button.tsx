"use client";

import PendingSubmitButton from "@/app/ogrenciler/[id]/pending-submit-button";
import GuardianIcon from "./guardian-icon";
import { deleteGuardianPortalAccount } from "./delete-actions";

export default function DeleteGuardianButton({ guardianId, name }: { guardianId: string; name: string }) {
  return <form action={deleteGuardianPortalAccount} onSubmit={(e) => {
    const ok = window.confirm(`${name || "Bu hesap"} portal hesabı silinsin mi?\n\nÖğrenci kaydı silinmez. Sadece portal hesabı ve öğrenci bağlantıları kaldırılır.`);
    if (!ok) e.preventDefault();
  }} style={{flex:"1 1 100%"}}>
    <input type="hidden" name="guardian_profile_id" value={guardianId}/>
    <PendingSubmitButton className="guardianButton guardianUnlinkButton" pendingText="Hesap siliniyor…"><GuardianIcon name="trash"/>Portal Hesabını Sil</PendingSubmitButton>
  </form>;
}
