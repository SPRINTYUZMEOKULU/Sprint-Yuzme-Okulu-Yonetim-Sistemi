import Link from "next/link";
import FollowUpSubmit from "./follow-up-submit";
import "./trial-lessons.css";
import { recordCandidateFollowUp } from "./actions";
import { CONTACT_LABELS, contactNeedsFollowUp, contactResolved, TRIAL_STATUS } from "@/lib/registrations/follow-up";
import { formatDisplayDateTime } from "@/lib/dates/display";
export default function CandidateFollowUp({studentId, consent, contacts, trial, groups}: {
  studentId:string;
  consent:{registration_for?:string|null;contact_request?:string|null;accepted_at?:string|null}|null;
  contacts:{new_value?:unknown}[];
  trial: {status?:string;group_name?:string;scheduled_at?:string;note?:string}|null;
  groups:{id:string;name:string;is_active?:boolean|null}[];
}) {
  const needsContact = !contactResolved(consent, contacts);
  return <section className="candidateFollowUp">

    <h2>Ön kayıt takip işlemleri</h2>
    {needsContact ? <div className="followUpAlert" role="alert"><strong>{CONTACT_LABELS[consent!.contact_request!]}</strong><p>Kesin kayıt öncesinde bu talebi karşılayıp görüşme sonucunu kaydediniz.</p>
      <form action={recordCandidateFollowUp}><input type="hidden" name="student_id" value={studentId}/><input type="hidden" name="kind" value="contact"/><label>Görüşme sonucu<textarea name="note" required minLength={5} maxLength={1000} placeholder={consent?.registration_for === "adult" ? "Kursiyerle görüşüldü, verilen bilgi ve görüşme sonucu…" : "Başvuru sahibiyle görüşme sonucu…"}/></label><FollowUpSubmit>Talep karşılandı · Kaydet</FollowUpSubmit></form>
    </div> : contactNeedsFollowUp(consent?.contact_request) ? <p>✓ İletişim talebi karşılandı; görüşme sonucu işlem geçmişinde saklanıyor.</p> : null}
    {consent?.contact_request === "trial_lesson" && !trial ? <div className="trialRequest" role="status"><strong>Deneme dersi talebi · Planlama bekliyor</strong><p>Başvuru sahibinin formdan gönderdiği talep alındı. Görüşüp aşağıdan grup, tarih ve saati belirleyiniz.</p></div> : null}
    <details open={trial?.status === "planned" || consent?.contact_request === "trial_lesson"}><summary>Deneme dersi {trial?.status ? `· ${TRIAL_STATUS[trial.status] || trial.status}` : "planla"}</summary>
      <p>Grup, tarih ve saati seçip kaydedin. Dersin ardından Katıldı, Gelmedi veya İptal sonucunu işleyin. Deneme, normal paketten ders düşürmez.</p><Link className="trialListLink" href="/deneme-dersleri">Deneme Dersleri listesini aç →</Link>
      {trial?.scheduled_at ? <p className="trialSaved"><strong>{trial.group_name}</strong> · {formatDisplayDateTime(new Date(trial.scheduled_at))}{trial.note ? ` · ${trial.note}` : ""}</p> : null}
      {trial?.status === "planned" ? <form action={recordCandidateFollowUp}><input type="hidden" name="student_id" value={studentId}/><input type="hidden" name="kind" value="trial"/><label>Deneme sonucu<select name="trial_status" required><option value="attended">Katıldı</option><option value="absent">Gelmedi</option><option value="cancelled">İptal edildi</option></select></label><label>Sonuç / eğitmen değerlendirmesi<textarea name="note" required minLength={5} maxLength={1000}/></label><FollowUpSubmit>Deneme sonucunu kaydet</FollowUpSubmit></form> :
      <form className="trialPlanForm" action={recordCandidateFollowUp}><input type="hidden" name="student_id" value={studentId}/><input type="hidden" name="kind" value="trial"/><input type="hidden" name="trial_status" value="planned"/><label>Deneme grubu<select name="group_id" required defaultValue=""><option value="" disabled>Grup seçiniz</option>{groups.filter(g=>g.is_active!==false).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Tarih ve saat (Türkiye)<input name="scheduled_at" type="datetime-local" required/></label><label className="trialFull">Not<textarea name="note" maxLength={1000}/></label><FollowUpSubmit>Deneme dersini planla</FollowUpSubmit></form>}
    </details>
  </section>;
}
