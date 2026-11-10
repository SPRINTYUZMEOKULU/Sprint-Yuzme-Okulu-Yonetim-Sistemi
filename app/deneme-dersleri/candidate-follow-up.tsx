import Link from "next/link";
import { recordCandidateFollowUp } from "./actions";
import { CONTACT_LABELS, contactResolved, TRIAL_STATUS } from "@/lib/registrations/follow-up";
import { formatDisplayDateTime } from "@/lib/dates/display";
export default function CandidateFollowUp({studentId, consent, contacts, trial, groups}: {
  studentId:string;
  consent:{contact_request?:string|null;accepted_at?:string|null}|null;
  contacts:{new_value?:unknown}[];
  trial: {status?:string;group_name?:string;scheduled_at?:string;note?:string}|null;
  groups:{id:string;name:string;is_active?:boolean|null}[];
}) {
  const needsContact = !contactResolved(consent, contacts);
  return <section className="candidateFollowUp">
    <style>{`.candidateFollowUp{margin:16px 0;padding:20px;border:1px solid #cbd5e1;border-radius:16px;background:white;color:#10253d}.candidateFollowUp form{display:grid;gap:12px;margin-top:12px}.candidateFollowUp label{display:grid;gap:6px;font-weight:700}.candidateFollowUp input,.candidateFollowUp select,.candidateFollowUp textarea,.candidateFollowUp button{font:inherit;padding:12px;border:1px solid #b9c8d8;border-radius:10px}.candidateFollowUp button{background:#123e64;color:white;cursor:pointer}.followUpAlert{padding:14px;border:2px solid #b45309;background:#fff7ed;border-radius:12px;animation:followUpPulse 2s ease-in-out infinite}.candidateFollowUp details{margin-top:18px}.candidateFollowUp summary{cursor:pointer;font-weight:800}@keyframes followUpPulse{50%{box-shadow:0 0 0 5px #fbbf2440}}@media(prefers-reduced-motion:reduce){.followUpAlert{animation:none}}`}</style>
    <h2>Ön kayıt takip işlemleri</h2>
    {needsContact ? <div className="followUpAlert" role="alert"><strong>{CONTACT_LABELS[consent!.contact_request!]}</strong><p>Kesin kayıt öncesinde bu talebi karşılayıp görüşme sonucunu kaydediniz.</p>
      <form action={recordCandidateFollowUp}><input type="hidden" name="student_id" value={studentId}/><input type="hidden" name="kind" value="contact"/><label>Görüşme sonucu<textarea name="note" required minLength={5} maxLength={1000} placeholder="Veliyle görüşüldü, verilen bilgi ve görüşme sonucu…"/></label><button>Talep karşılandı · Kaydet</button></form>
    </div> : consent?.contact_request && CONTACT_LABELS[consent.contact_request] ? <p>✓ İletişim talebi karşılandı; görüşme sonucu işlem geçmişinde saklanıyor.</p> : null}
    <details open={trial?.status === "planned"}><summary>Deneme dersi {trial?.status ? `· ${TRIAL_STATUS[trial.status] || trial.status}` : "planla"}</summary>
      <p>Deneme dersi ayrı takip edilir. Normal paket, ödeme veya ders sayacı oluşturulmaz. <Link href="/deneme-dersleri">Deneme dersleri listesi →</Link></p>
      {trial?.scheduled_at ? <p><strong>{trial.group_name}</strong> · {formatDisplayDateTime(new Date(trial.scheduled_at))}{trial.note ? ` · ${trial.note}` : ""}</p> : null}
      {trial?.status === "planned" ? <form action={recordCandidateFollowUp}><input type="hidden" name="student_id" value={studentId}/><input type="hidden" name="kind" value="trial"/><label>Deneme sonucu<select name="trial_status" required><option value="attended">Katıldı</option><option value="absent">Gelmedi</option><option value="cancelled">İptal edildi</option></select></label><label>Sonuç / eğitmen değerlendirmesi<textarea name="note" required minLength={5} maxLength={1000}/></label><button>Deneme sonucunu kaydet</button></form> :
      <form action={recordCandidateFollowUp}><input type="hidden" name="student_id" value={studentId}/><input type="hidden" name="kind" value="trial"/><input type="hidden" name="trial_status" value="planned"/><label>Deneme grubu<select name="group_id" required defaultValue=""><option value="" disabled>Grup seçiniz</option>{groups.filter(g=>g.is_active!==false).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Tarih ve saat (Türkiye)<input name="scheduled_at" type="datetime-local" required/></label><label>Not<textarea name="note" maxLength={1000}/></label><button>Deneme dersini planla</button></form>}
    </details>
  </section>;
}
