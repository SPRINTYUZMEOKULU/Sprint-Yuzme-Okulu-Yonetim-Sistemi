"use client";
import { unlinkGuardianStudentCanonical } from "./[id]/actions";
import PendingSubmitButton from "@/app/ogrenciler/[id]/pending-submit-button";

export default function UnlinkStudentButton({ profileId, studentId, name }: {
  profileId: string; studentId: string; name: string;
}) {
  return <form action={unlinkGuardianStudentCanonical} onSubmit={(event) => {
    if (!window.confirm(`${name} için bu veliyle öğrenci bağlantısı kaldırılsın mı? Öğrenci kaydı ve veli hesabı korunur.`)) event.preventDefault();
  }}>
    <input type="hidden" name="guardian_profile_id" value={profileId} />
    <input type="hidden" name="student_id" value={studentId} />
    <PendingSubmitButton className="guardianButton guardianUnlinkButton" pendingText="Kaldırılıyor…">Bağlantıyı Kaldır</PendingSubmitButton>
  </form>;
}
