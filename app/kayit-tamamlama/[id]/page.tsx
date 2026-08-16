import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import RegistrationWizard from "./registration-wizard";
import "./registration-completion.css";

export const dynamic = "force-dynamic";

export default async function RegistrationCompletionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
  ]);

  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const [
    { data: student },
    { data: branches },
    { data: rawGroups },
    { data: schedules },
    { data: packages },
    { data: coaches },
    { data: templateRow },
  ] = await Promise.all([
    supabase
      .from("students")
      .select(`
        id,
        student_number,
        first_name,
        last_name,
        phone,
        email,
        guardian_name,
        guardian_phone,
        guardian_email,
        branch_id,
        preferred_group_id,
        preferred_package_id,
        preferred_days,
        preferred_time,
        swimming_level,
        status
      `)
      .eq("id", id)
      .eq("organization_id", profile.organization_id)
      .single(),

    supabase
      .from("branches")
      .select(`
        id,
        name,
        location_url,
        contact_phone,
        material_list
      `)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("training_groups")
      .select(`
        id,
        name,
        branch_id,
        course_type,
        primary_coach_id
      `)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("lesson_schedules")
      .select(`
        group_id,
        weekday,
        start_time,
        end_time
      `)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("weekday"),

    supabase
      .from("course_packages")
      .select(`
        id,
        name,
        lesson_count,
        price
      `)
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("lesson_count"),

    supabase
      .from("profiles")
      .select("id,full_name")
      .eq("organization_id", profile.organization_id)
      .eq("role", "coach")
      .eq("is_active", true)
      .order("full_name"),

    supabase
      .from("message_templates")
      .select("body")
      .eq("organization_id", profile.organization_id)
      .eq("template_key", "registration_completed")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!student) {
    notFound();
  }

  const groups = (rawGroups || []).map((group) => ({
    ...group,
    schedules: (schedules || []).filter(
      (item) => item.group_id === group.id
    ),
  }));

  const fallbackTemplate =
    "Sayın {{veli_adi}},\n\n" +
    "{{ogrenci_adi}} adına Sprint Yüzme Okulu kayıt işleminiz başarıyla tamamlanmıştır.\n\n" +
    "Öğrenci No: {{ogrenci_no}}\n" +
    "Şube: {{sube}}\n" +
    "Grup: {{grup}}\n" +
    "Günler: {{gunler}}\n" +
    "Saat: {{saat}}\n" +
    "Paket: {{paket}}\n" +
    "Ders Sayısı: {{ders_sayisi}}\n" +
    "Başlangıç: {{baslangic}}\n" +
    "Planlanan Bitiş: {{bitis}}\n\n" +
    "{{malzemeler}}\n\n" +
    "Konum: {{konum}}\n" +
    "İletişim: {{telefon}}\n\n" +
    "Keyifli dersler dileriz.\n" +
    "Sprint Yüzme Okulu";

  return (
    <main className="completionPage">
      <header className="completionHeader">
        <div>
          <p>SPRİNTOS · KAYIT OPERASYONU</p>

          <h1>Kayıt Tamamlama Sihirbazı</h1>

          <span>
            {student.first_name} {student.last_name} için şube, grup,
            gerçek katılım günleri, ders sayısı ve bitiş tarihini
            tamamlayın.
          </span>
        </div>

        <Link href="/on-kayitlar">
          ← Ön Kayıtlara Dön
        </Link>
      </header>

      {query.error ? (
        <div className="errorBanner">
          {query.error}
        </div>
      ) : null}

      <RegistrationWizard
        student={student}
        branches={branches || []}
        groups={groups}
        packages={packages || []}
        coaches={coaches || []}
        template={templateRow?.body || fallbackTemplate}
      />
    </main>
  );
}
