import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import RegistrationWizard from "./registration-wizard";
import RegistrationMessageAutoSync from "./registration-message-auto-sync";
import LegacyTransferControls from "./legacy-transfer-controls";
import "./registration-completion.css";

export const dynamic = "force-dynamic";

function ageFromBirthDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday = now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export default async function RegistrationCompletionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>; }) {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: student }, { data: branches }, { data: rawGroups }, { data: schedules }, { data: packages }, { data: coaches }, { data: templateRow }, { data: consent }, { data: draft }, { data: activeEnrollment }, { data: payments }, { data: notes }] = await Promise.all([
    supabase.from("students").select("id,student_number,first_name,last_name,phone,email,guardian_name,guardian_phone,guardian_email,branch_id,preferred_group_id,preferred_package_id,preferred_days,preferred_time,swimming_level,status,registration_note,birth_date,created_at").eq("id", id).eq("organization_id", profile.organization_id).single(),
    supabase.from("branches").select("id,name,location_url,contact_phone,material_list").eq("organization_id", profile.organization_id).eq("is_active", true).order("name"),
    supabase.from("training_groups").select("id,name,branch_id,course_type,primary_coach_id").eq("organization_id", profile.organization_id).eq("is_active", true).order("name"),
    supabase.from("lesson_schedules").select("group_id,weekday,start_time,end_time").eq("organization_id", profile.organization_id).eq("is_active", true).order("weekday"),
    supabase.from("course_packages").select("id,name,lesson_count,price,course_type").eq("organization_id", profile.organization_id).eq("is_active", true).order("lesson_count"),
    supabase.from("profiles").select("id,full_name").eq("organization_id", profile.organization_id).eq("role", "coach").eq("is_active", true).order("full_name"),
    supabase.from("message_templates").select("body").eq("organization_id", profile.organization_id).eq("template_key", "registration_completed").eq("is_active", true).maybeSingle(),
    supabase.from("registration_consents").select("student_id,registration_for,health_declaration,health_note,rules_accepted,whatsapp_permission,contact_request,rules_version,form_version,accepted_at,form_snapshot").eq("organization_id", profile.organization_id).eq("student_id", id).order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("registration_completion_checklists").select("student_id,enrollment_id,payment_received,health_declaration_received,rules_accepted,message_prepared,message_sent,location_sent,swim_cap_delivered,receipt_created,draft_data,draft_saved_at,payment_due_date,payment_due_date_manual,payment_note,message_draft,updated_at").eq("organization_id", profile.organization_id).eq("student_id", id).maybeSingle(),
    supabase.from("student_enrollments").select("id,student_id,package_id,group_id,start_date,planned_end_date,lesson_weekdays,total_lessons,used_lessons,payment_due_date,status,created_at").eq("organization_id", profile.organization_id).eq("student_id", id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("student_payments").select("id,student_id,enrollment_id,amount,currency,payment_method,payment_status,description,received_at,cash_handover_status,cancelled_at").eq("organization_id", profile.organization_id).eq("student_id", id).order("received_at", { ascending: false }),
    supabase.from("student_activity_logs").select("id,student_id,activity_type,title,description,performed_at,reminder_at,reminder_completed,reminder_completed_at,performed_by").eq("organization_id", profile.organization_id).eq("student_id", id).eq("activity_type", "registration_note").order("performed_at", { ascending: false }).limit(50),
  ]);
  if (!student) notFound();
  const groups = (rawGroups || []).map((group) => ({ ...group, schedules: (schedules || []).filter((item) => item.group_id === group.id) }));
  const fallbackTemplate = "🏊 SPRİNT YÜZME OKULU’NA HOŞ GELDİNİZ\n\nSayın {{veli_adi}},\n\n{{ogrenci_adi}} adına Sprint Yüzme Okulu kayıt işleminiz başarıyla tamamlanmıştır.\n\nÖğrenci No: {{ogrenci_no}}\nŞube: {{sube}}\nKurs Türü: {{kurs_turu}}\nGrup: {{grup}}\nGünler: {{gunler}}\nSaat: {{saat}}\nPaket: {{paket}}\nDers Sayısı: {{ders_sayisi}}\nBaşlangıç: {{baslangic}}\nPlanlanan Bitiş: {{bitis}}\nÖdeme Vadesi: {{vade_tarihi}}\n\n{{malzemeler}}\n\nKonum: {{konum}}\nİletişim: {{telefon}}\n\nKeyifli ve başarılı bir yüzme dönemi dileriz.\nSPRİNT YÜZME OKULU\nBilgilendirme Hattı: 0551 896 83 19";
  const missingElectronicConsent = !consent?.rules_accepted || !consent?.health_declaration;
  const canManagerConfirm = profile.role === "owner" || profile.role === "admin";
  const attendanceHref = activeEnrollment?.group_id && query.scheduleId && query.date ? `/yoklama?groupId=${encodeURIComponent(activeEnrollment.group_id)}&scheduleId=${encodeURIComponent(query.scheduleId)}&date=${encodeURIComponent(query.date)}` : "/yoklama";
  const studentAge = ageFromBirthDate(student.birth_date);
  return <main className="completionPage">
    <header className="completionHeader"><div className="headerIdentity"><div className="headerKicker">SPRİNTOS · KESİN KAYIT OPERASYONU</div><h1>Kesin Kayıt Merkezi</h1><p><strong>{student.first_name} {student.last_name}</strong>{" · "}{student.student_number || "Öğrenci numarası kayıt tamamlandığında hazır olacak"}{student.birth_date ? <>{" · Doğum Tarihi: "}{new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${student.birth_date}T12:00:00`))}{studentAge !== null ? ` · Yaş: ${studentAge}` : ""}</> : null}</p></div>
      <div className="headerLinks">{query.arrival === "1" ? <Link href={attendanceHref}>✓ Öğrenci Geldi · Yoklama</Link> : null}<Link href={`/ogrenciler/${student.id}?portal=1`}>Portal Şifresi + WhatsApp</Link><Link href="/">Ana Sayfa</Link><Link href={`/on-kayitlar?student=${student.id}`}>Ön Kaydı Gör</Link><Link href="/on-kayitlar">Ön Kayıtlara Dön</Link></div></header>
    {query.arrival === "1" ? <div className="successBanner">İlk ders karşılama akışı açık. Kayıt mesajını WhatsApp’tan gönderebilir, portal şifresini hazırlayabilir ve öğrenciyi yoklamada “Geldi” olarak işleyebilirsiniz.</div> : null}
    {query.error ? <div className="errorBanner">{query.error}</div> : null}
    {query.saved ? <div className="successBanner">Taslak bilgiler kaydedildi.</div> : null}
    {query.note_saved ? <div className="successBanner">Not ve hatırlatma kaydedildi.</div> : null}
    {query.legacy_manager_confirmed ? <div className="successBanner">Yönetici teyidi kaydedildi. Aktarım kontrolleri yönetici onayıyla tamamlandı.</div> : null}
    {query.legacy_compensation_added ? <div className="successBanner">{query.legacy_compensation_added} adet aktarım telafisi öğrenciye eklendi.</div> : null}
    <RegistrationMessageAutoSync />
    <RegistrationWizard student={student} branches={branches || []} groups={groups} packages={packages || []} coaches={coaches || []} template={templateRow?.body || fallbackTemplate} consent={consent || null} draft={draft || null} activeEnrollment={activeEnrollment || null} payments={payments || []} notes={notes || []} />
    <LegacyTransferControls studentId={student.id} visible={missingElectronicConsent} canManagerConfirm={canManagerConfirm} />
  </main>;
}
