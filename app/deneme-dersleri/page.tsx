import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { formatDisplayDateTime } from "@/lib/dates/display";
import { TRIAL_STATUS } from "@/lib/registrations/follow-up";
import "../dashboard.css";
export const dynamic = "force-dynamic";
export default async function TrialLessonsPage() {
  const profile = await requireProfile(["owner","admin","branch_manager","registration_staff"]);
  const supabase = await createClient();
  const {data: logs, error} = await supabase.from("student_activity_logs").select("student_id,new_value,performed_at").eq("organization_id",profile.organization_id).eq("activity_type","trial_lesson").order("performed_at",{ascending:false}).limit(1000);
  if (error) throw new Error("Deneme dersleri okunamadı.");
  const latest = new Map<string,{status:string;group_name:string;scheduled_at:string;note?:string}>();
  for (const row of logs || []) if (!latest.has(row.student_id)) latest.set(row.student_id,row.new_value);
  const ids = [...latest.keys()];
  const {data: students, error: studentsError} = ids.length ? await supabase.from("students").select("id,first_name,last_name,status").eq("organization_id",profile.organization_id).in("id",ids) : {data:[],error:null};
  if (studentsError) throw new Error("Deneme öğrencileri okunamadı.");
  const studentMap = new Map((students || []).map(s=>[s.id,s]));
  const planned = [...latest.values()].filter(v=>v.status === "planned").length;
  const entries = [...latest.entries()].sort((a,b)=>Number(b[1].status === "planned")-Number(a[1].status === "planned") || a[1].scheduled_at.localeCompare(b[1].scheduled_at));
  return <main className="operationPage"><header className="operationHeader"><div><h1>Deneme Dersleri</h1><p>{planned} planlanan deneme</p></div><div className="operationActions"><Link href="/on-kayitlar">Ön Kayıt Merkezi</Link><Link href="/">Ana Sayfa</Link></div></header>
    <p>Deneme planlamak için öğrencinin ön kaydından Kesin Kayıt Merkezi’ni açınız. Deneme dersleri normal paket ve ders sayacından bağımsız takip edilir.</p>
    {logs?.length === 1000 ? <p role="status">Son 1000 deneme işlemi gösteriliyor.</p> : null}
    <div style={{display:"grid",gap:16}}>{entries.map(([id,trial])=>{const student=studentMap.get(id);return <article key={id} style={{padding:20,border:"1px solid #cbd5e1",borderRadius:14,background:"white"}}><h2>{student ? `${student.first_name} ${student.last_name}` : "Öğrenci"}</h2><p><strong>{TRIAL_STATUS[trial.status] || trial.status}</strong> · {trial.group_name} · {formatDisplayDateTime(new Date(trial.scheduled_at))}</p>{trial.note ? <p>{trial.note}</p>:null}<Link href={student?.status === "pre_registration" ? `/kayit-tamamlama/${id}` : `/ogrenciler/${id}`}>{student?.status === "pre_registration" ? "Denemeyi yönet / Kesin kayda geç →" : "Öğrenci dosyası →"}</Link></article>})}</div>
    {!entries.length ? <p>Henüz deneme dersi planlanmadı.</p> : null}
  </main>;
}
