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

    { data: consent },

    { data: draft },

    { data: activeEnrollment },

    { data: payments },

    { data: notes },
  ] = await Promise.all([
    /*
     * =====================================================
     * ÖĞRENCİ
     * =====================================================
     */
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
        status,
        registration_note,
        birth_date,
        created_at
      `)
      .eq(
        "id",
        id
      )
      .eq(
        "organization_id",
        profile.organization_id
      )
      .single(),

    /*
     * =====================================================
     * ŞUBELER
     * =====================================================
     */
    supabase
      .from("branches")
      .select(`
        id,
        name,
        location_url,
        contact_phone,
        material_list
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "is_active",
        true
      )
      .order("name"),

    /*
     * =====================================================
     * GRUPLAR
     * =====================================================
     */
    supabase
      .from("training_groups")
      .select(`
        id,
        name,
        branch_id,
        course_type,
        primary_coach_id
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "is_active",
        true
      )
      .order("name"),

    /*
     * =====================================================
     * DERS PROGRAMI
     * =====================================================
     */
    supabase
      .from("lesson_schedules")
      .select(`
        group_id,
        weekday,
        start_time,
        end_time
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "is_active",
        true
      )
      .order("weekday"),

    /*
     * =====================================================
     * PAKETLER
     *
     * course_type özellikle eklenmiştir.
     * Seçilen grubun kurs türüne göre paket filtreleyeceğiz.
     * =====================================================
     */
    supabase
      .from("course_packages")
      .select(`
        id,
        name,
        lesson_count,
        price,
        course_type
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "is_active",
        true
      )
      .order("lesson_count"),

    /*
     * =====================================================
     * ANTRENÖRLER
     * =====================================================
     */
    supabase
      .from("profiles")
      .select(`
        id,
        full_name
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "role",
        "coach"
      )
      .eq(
        "is_active",
        true
      )
      .order("full_name"),

    /*
     * =====================================================
     * KAYIT TAMAMLANDI MESAJ ŞABLONU
     * =====================================================
     */
    supabase
      .from("message_templates")
      .select("body")
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "template_key",
        "registration_completed"
      )
      .eq(
        "is_active",
        true
      )
      .maybeSingle(),

    /*
     * =====================================================
     * ÖN KAYIT ELEKTRONİK ONAYI
     *
     * Sağlık / kurallar artık manuel checkbox olmayacak.
     * Gerçek ön kayıt kaydından okunacak.
     * =====================================================
     */
    supabase
      .from("registration_consents")
      .select(`
        student_id,
        registration_for,
        health_declaration,
        health_note,
        rules_accepted,
        whatsapp_permission,
        contact_request,
        rules_version,
        form_version,
        accepted_at,
        form_snapshot
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "student_id",
        id
      )
      .order(
        "accepted_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle(),

    /*
     * =====================================================
     * KAYIT TAMAMLAMA TASLAĞI
     *
     * Bir bölümü doldurup Kaydet dediğimizde
     * buradan tekrar devam edebileceğiz.
     * =====================================================
     */
    supabase
      .from(
        "registration_completion_checklists"
      )
      .select(`
        student_id,
        enrollment_id,

        payment_received,

        health_declaration_received,
        rules_accepted,

        message_prepared,
        message_sent,
        location_sent,

        swim_cap_delivered,
        receipt_created,

        draft_data,
        draft_saved_at,

        payment_due_date,
        payment_due_date_manual,
        payment_note,

        message_draft,

        updated_at
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "student_id",
        id
      )
      .maybeSingle(),

    /*
     * =====================================================
     * AKTİF ENROLLMENT
     *
     * Vadenin gerçek kaynağı:
     * student_enrollments.payment_due_date
     * =====================================================
     */
    supabase
      .from("student_enrollments")
      .select(`
        id,
        student_id,
        package_id,
        group_id,
        start_date,
        planned_end_date,
        lesson_weekdays,
        total_lessons,
        used_lessons,
        payment_due_date,
        status,
        created_at
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "student_id",
        id
      )
      .eq(
        "status",
        "active"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle(),

    /*
     * =====================================================
     * GERÇEK ÖDEME HAREKETLERİ
     *
     * Manuel "ödeme alındı" checkboxı kullanmayacağız.
     * student_payments üzerinden hesaplanacak.
     * =====================================================
     */
    supabase
      .from("student_payments")
      .select(`
        id,
        student_id,
        enrollment_id,
        amount,
        currency,
        payment_method,
        payment_status,
        description,
        received_at,
        cash_handover_status,
        cancelled_at
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "student_id",
        id
      )
      .order(
        "received_at",
        {
          ascending: false,
        }
      ),

    /*
     * =====================================================
     * KAYIT NOTLARI + HATIRLATMALAR
     * =====================================================
     */
    supabase
      .from("student_activity_logs")
      .select(`
        id,
        student_id,
        activity_type,
        title,
        description,
        performed_at,
        reminder_at,
        reminder_completed,
        reminder_completed_at,
        performed_by
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "student_id",
        id
      )
      .eq(
        "activity_type",
        "registration_note"
      )
      .order(
        "performed_at",
        {
          ascending: false,
        }
      )
      .limit(50),
  ]);

  if (!student) {
    notFound();
  }

  /*
   * =====================================================
   * GRUP + DERS PROGRAMI
   * =====================================================
   */

  const groups =
    (rawGroups || []).map(
      (group) => ({
        ...group,

        schedules:
          (schedules || []).filter(
            (item) =>
              item.group_id ===
              group.id
          ),
      })
    );

  /*
   * =====================================================
   * FALLBACK WHATSAPP ŞABLONU
   *
   * Ayarlar -> Mesaj Şablonları kaydı varsa
   * bu kullanılmayacak.
   * =====================================================
   */

  const fallbackTemplate =
    "Sayın {{veli_adi}},\n\n" +

    "{{ogrenci_adi}} adına Sprint Yüzme Okulu kayıt işleminiz başarıyla tamamlanmıştır.\n\n" +

    "Öğrenci No: {{ogrenci_no}}\n" +

    "Şube: {{sube}}\n" +

    "Kurs Türü: {{kurs_turu}}\n" +

    "Grup: {{grup}}\n" +

    "Günler: {{gunler}}\n" +

    "Saat: {{saat}}\n" +

    "Paket: {{paket}}\n" +

    "Ders Sayısı: {{ders_sayisi}}\n" +

    "Başlangıç: {{baslangic}}\n" +

    "Planlanan Bitiş: {{bitis}}\n" +

    "Ödeme Vadesi: {{vade_tarihi}}\n\n" +

    "{{malzemeler}}\n\n" +

    "Konum: {{konum}}\n" +

    "İletişim: {{telefon}}\n\n" +

    "Keyifli dersler dileriz.\n" +

    "Sprint Yüzme Okulu";

  return (
    <main className="completionPage">

      {/*
       * ===================================================
       * ÜST BAŞLIK
       * ===================================================
       */}

      <header className="completionHeader">

        <div className="headerIdentity">

          <div className="headerKicker">
            SPRİNTOS · KESİN KAYIT OPERASYONU
          </div>

          <h1>
            Kesin Kayıt Merkezi
          </h1>

          <p>
            <strong>
              {student.first_name}{" "}
              {student.last_name}
            </strong>

            {" · "}

            {student.student_number ||
              "Öğrenci numarası kayıt tamamlandığında hazır olacak"}

            {student.birth_date ? (
              <>
                {" · Doğum Tarihi: "}
                {new Intl.DateTimeFormat("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(new Date(`${student.birth_date}T12:00:00`))}
              </>
            ) : null}
          </p>

        </div>

        {/*
         * =================================================
         * ÜST NAVİGASYON
         * =================================================
         */}

        <div className="headerLinks">

          <Link href="/">
            Ana Sayfa
          </Link>

          <Link
            href={
              `/on-kayitlar?student=${student.id}`
            }
          >
            Ön Kaydı Gör
          </Link>

          <Link href="/on-kayitlar">
            Ön Kayıtlara Dön
          </Link>

        </div>

      </header>

      {/*
       * ===================================================
       * DURUM MESAJLARI
       * ===================================================
       */}

      {query.error ? (
        <div className="errorBanner">
          {query.error}
        </div>
      ) : null}

      {query.saved ? (
        <div className="successBanner">
          Taslak bilgiler kaydedildi.
        </div>
      ) : null}

      {query.note_saved ? (
        <div className="successBanner">
          Not ve hatırlatma kaydedildi.
        </div>
      ) : null}

      {/*
       * ===================================================
       * KESİN KAYIT CLIENT
       * ===================================================
       */}

      <RegistrationWizard
        student={student}

        branches={
          branches || []
        }

        groups={
          groups
        }

        packages={
          packages || []
        }

        coaches={
          coaches || []
        }

        template={
          templateRow?.body ||
          fallbackTemplate
        }

        consent={
          consent || null
        }

        draft={
          draft || null
        }

        activeEnrollment={
          activeEnrollment || null
        }

        payments={
          payments || []
        }

        notes={
          notes || []
        }
      />

    </main>
  );
}
