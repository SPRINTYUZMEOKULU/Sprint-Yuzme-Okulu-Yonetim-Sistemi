"use client";
import { useFormStatus } from "react-dom";
function Submit() {
  const {pending} = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Talep gönderiliyor…" : "Yönetici Onayına Gönder"}</button>;
}
export default function RegistrationCloseRequest({studentId, name, action}: {
  studentId: string; name: string; action: (data: FormData) => void | Promise<void>;
}) {
  return <details className="passiveDetails">
    <summary>Kayıt Gerçekleşmedi</summary>
    <form action={action} className="passiveForm" onSubmit={event => {
      if (!window.confirm(`${name} için ön kayıt kapatma talebi yönetici onayına gönderilsin mi?\n\nOnay verilene kadar kayıt kapanmaz. Form ve işlem geçmişi korunur.`)) event.preventDefault();
    }} style={{display:"grid", gap:12, padding:16, border:"1px solid #fed7aa", borderRadius:12, maxWidth:420}}>
      <input type="hidden" name="student_id" value={studentId}/>
      <label>Başvurunun kapanma gerekçesi<textarea name="reason" required minLength={5} maxLength={500} placeholder="Örn: Veli kayıt yaptırmaktan vazgeçti." style={{display:"block", width:"100%", minHeight:80}}/></label>
      <label style={{display:"flex", gap:8, alignItems:"flex-start"}}><input type="checkbox" name="closure_confirmed" required/>Bu başvurunun kesin kaydının gerçekleşmediğini ve yönetici onayına sunulacağını onaylıyorum.</label>
      <small>Bu işlem kaydı silmez veya pasif kursiyere dönüştürmez. Yönetici onaylarsa “Kayıt Gerçekleşmedi” listesine taşınır.</small>
      <Submit/>
    </form>
  </details>;
}
