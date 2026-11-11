import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { formatDisplayDateTime } from "@/lib/dates/display";
import { TRIAL_STATUS } from "@/lib/registrations/follow-up";
import "../dashboard.css";
import "./trial-lessons.css";
export const dynamic = "force-dynamic";
type Trial = {status:string;group_name?:string;scheduled_at?:string;note?:string};
export default async function TrialLessonsPage() {
  const profile = await requireProfile(["owner","admin","branch_manager","registration_staff"]);
  const supabase = await createClient();
  const [{data: logs, error},{data: consents,error:consentError}] = await Promise.all([
    supabase.from("student_activity_logs").select("student_id,new_value,performed_at").eq("organization_id",profile.organization_id).eq("activity_type","trial_lesson").order("performed_at",{ascending:false}).limit(1000),
    supabase.from("registration_consents").select("student_id,contact_request,accepted_at").eq("organization_id",profile.organization_id).order("accepted_at",{ascending:false}).limit(1000),
  ]);
  if (error || consentError) throw new Error("Deneme talepleri ve dersleri okunamadı.");
  const latest = new Map<string,Trial>();
  for (const row of logs || []) if (!latest.has(row.student_id) && row.new_value?.status) latest.set(row.student_id,row.new_value);
  const seen = new Set<string>();
  const requested = new Set<string>();
  for (const row of consents || []) {
    if (seen.has(row.student_id)) continue;
    seen.add(row.student_id);
    if (row.contact_request === "trial_lesson" && !latest.has(row.student_id)) requested.add(row.student_id);
  }
  const ids = [...new Set([...latest.keys(),...requested])];
  const {data: students, error: studentsError} = ids.length ? await supabase.from("students").select("id,first_name,last_name,status").eq("organization_id",profile.organization_id).in("id",ids) : {data:[],error:null};
  if (studentsError) throw new Error("Deneme öğrencileri okunamadı.");
  const studentMap = new Map((students || []).map(s=>[s.id,s]));
  for (const id of requested) if (studentMap.get(id)?.status === "pre_registration") latest.set(id,{status:"requested"});
  const planned = [...latest.values()].filter(v=>v.status === "planned").length;
  const waiting = [...latest.values()].filter(v=>v.status === "requested").length;
  const rank = (s:string)=>s === "requested" ? 0 : s === "planned" ? 1 : 2;
  const entries = [...latest.entries()].filter(([id])=>studentMap.has(id)).sort((a,b)=>rank(a[1].status)-rank(b[1].status) || (a[1].scheduled_at || "").localeCompare(b[1].scheduled_at || ""));
  return <main className="operationPage trialCenter">
    <header className="operationHeader"><div><h1>Deneme Dersleri</h1><p>{waiting} okul onayı bekleyen talep · {planned} onaylı ders</p></div><div className="operationActions"><Link href="/on-kayitlar">Ön Kayıt Merkezi</Link><Link href="/">Ana Sayfa</Link></div></header>
    <div className="trialIntro"><strong>Talebi alın, dersi planlayın, sonucunu kaydedin.</strong><p>Formda “Önce deneme dersi yapmak istiyorum” seçen başvurular burada Okul Onayı Bekliyor olarak görünür; onaylanmadan kabul edilmiş sayılmaz. Deneme yalnızca 6 yaş ve altındaki çocuklar içindir, yetişkinlere uygulanmaz ve kişi başına bir kez alınabilir. Kaydı açıp grup, tarih ve saat seçerek okul adına onaylayınız; ardından veli bilgilendirmesini gönderiniz. Dersten sonra Katıldı / Gelmedi / İptal sonucunu işleyiniz. Tüm işlemler öğrenci dosyasının geçmişinde saklanır; normal paket, ödeme ve ders sayacına işlenmez.</p></div>
    {(logs?.length === 1000 || consents?.length === 1000) ? <p role="status">Son 1000 işlem ve başvuru inceleniyor.</p> : null}
    <div className="trialCards">{entries.map(([id,trial])=>{const student=studentMap.get(id)!;return <article key={id} className="trialCard"><h2>{student.first_name} {student.last_name}</h2><span className="trialStatus">{trial.status === "requested" ? "Talep alındı · Okul onayı bekliyor" : TRIAL_STATUS[trial.status] || trial.status}</span>{trial.group_name ? <p>{trial.group_name}{trial.scheduled_at ? ` · ${formatDisplayDateTime(new Date(trial.scheduled_at))}` : ""}</p> : <p>Tarih ve saat henüz belirlenmedi.</p>}{trial.note ? <p>{trial.note}</p>:null}<Link href={student.status === "pre_registration" ? `/kayit-tamamlama/${id}` : `/ogrenciler/${id}`}>{student.status === "pre_registration" ? "Denemeyi planla / Sonucu kaydet →" : "Öğrenci dosyası →"}</Link></article>})}</div>
    {!entries.length ? <div className="trialIntro">Henüz deneme talebi veya planlanan ders yok. Mevcut bir ön kaydı açarak da deneme planlayabilirsiniz.</div> : null}
  </main>;
}
