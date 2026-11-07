import PreRegistrationDisposition from "@/app/components/pre-registration-disposition";
import Link from "next/link";
import {requireProfile} from "@/lib/auth/profile";
import {createClient} from "@/lib/supabase/server";
import {formatDisplayDateTime} from "@/lib/dates/display";
export const dynamic = "force-dynamic";
export default async function ClosedRegistrations() {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
  const client = await createClient();
  const {data: students, error} = await client.from("students").select("id,first_name,last_name,updated_at")
    .eq("organization_id", profile.organization_id).eq("status", "registration_declined").eq("is_deleted", false).order("updated_at", {ascending:false});
  return <main style={{padding:24, maxWidth:1100, margin:"0 auto"}}>
    <Link href="/on-kayitlar">← Ön Kayıtlara Dön</Link><h1>Kayıt Gerçekleşmedi</h1>
    <p>Kapatılan ve arşive kaldırılan başvurular. Form ve işlem geçmişi dosyada korunur.</p>
    {error ? <p role="alert">Başvurular yüklenemedi. Lütfen yeniden deneyin.</p> : !students?.length ? <p>Arşivlenmiş başvuru bulunmuyor.</p> :
    <div style={{display:"grid", gap:12}}>{students.map(student => <article key={student.id} style={{padding:20, border:"1px solid #e2e8f0", borderRadius:14, background:"white"}}>
      <strong>{student.first_name} {student.last_name}</strong><p>Kayıt Gerçekleşmedi · {formatDisplayDateTime(new Date(student.updated_at))}</p>
      {["owner","admin"].includes(profile.role) && <PreRegistrationDisposition studentId={student.id} name={`${student.first_name} ${student.last_name}`}/>}
      <Link href={`/ogrenciler/${student.id}#islem-gecmisi`}>Dosya ve İşlem Geçmişi →</Link>
    </article>)}</div>}
  </main>;
}
