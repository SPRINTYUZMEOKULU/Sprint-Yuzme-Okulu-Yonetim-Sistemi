import Link from "next/link";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import CopyLinkButton from "./copy-link-button";
import PreRegistrationCenter from "./pre-registration-center";
import "../dashboard.css";
import "./pre-registration-center.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  student?: string;
  updated?: string;
}>;

type PreStudent = {
  id: string;
  student_number: string | null;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  preferred_days: string | null;
  preferred_time: string | null;
  swimming_level: string | null;
  registration_source: string | null;
  registration_note: string | null;
  created_at: string;
  branch_id: string | null;
  preferred_group_id: string | null;
  preferred_package_id: string | null;
  status: string;
};

type ConsentRow = {
  student_id: string;
  registration_for: string | null;
  health_declaration: boolean | null;
  health_note: string | null;
  rules_accepted: boolean | null;
  whatsapp_permission: boolean | null;
  contact_request: string | null;
  rules_version: string | null;
  form_version: string | null;
  accepted_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  form_snapshot: unknown;
};

type ActivityRow = {
  student_id: string;
  activity_type: string | null;
  title: string | null;
  description: string | null;
  new_value: unknown;
  source_type: string | null;
  performed_at: string | null;
};

export default async function PreRegistrationsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
  ]);

  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const initialSelectedId = params.student || null;

  const [
    { data: students },
    { data: branches },
    { data: groups },
    { data: packages },
    { data: consents },
    { data: activities },
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id,student_number,first_name,last_name,birth_date,phone,guardian_name,guardian_phone,preferred_days,preferred_time,swimming_level,registration_source,registration_note,created_at,branch_id,preferred_group_id,preferred_package_id,status"
      )
      .eq("organization_id", profile.organization_id)
      .eq("status", "pre_registration")
      .order("created_at", { ascending: false })
      .limit(250),

    supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", profile.organization_id)
      .order("name"),

    supabase
      .from("training_groups")
      .select("id,name,branch_id,course_type,is_active")
      .eq("organization_id", profile.organization_id)
      .order("name"),

    supabase
      .from("course_packages")
      .select("id,name,lesson_count,price,is_active")
      .eq("organization_id", profile.organization_id)
      .order("name"),

    supabase
      .from("registration_consents")
      .select(
        "student_id,registration_for,health_declaration,health_note,rules_accepted,whatsapp_permission,contact_request,rules_version,form_version,accepted_at,ip_address,user_agent,form_snapshot"
      )
      .eq("organization_id", profile.organization_id)
      .order("accepted_at", { ascending: false })
      .limit(500),

    supabase
      .from("student_activity_logs")
      .select(
        "student_id,activity_type,title,description,new_value,source_type,performed_at"
      )
      .eq("organization_id", profile.organization_id)
      .order("performed_at", { ascending: false })
      .limit(1000),
  ]);

  const list = (students || []) as PreStudent[];
  const consentList = (consents || []) as ConsentRow[];
  const activityList = (activities || []) as ActivityRow[];

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = list.filter(
    (item) => item.created_at?.slice(0, 10) === today
  ).length;

  const host = (await headers()).get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const formUrl = `${protocol}://${host}/on-kayit`;

  return (
    <main className="operationPage preRegistrationPage">
      <header className="operationHeader">
        <div>
          <p>SPRİNTOS · KAYIT OPERASYONU</p>
          <h1>Ön Kayıt Merkezi</h1>
          <span>
            Başvuruyu görüntüleyin, gerektiğinde düzenleyin, tüm değişiklikleri
            işlem geçmişinde izleyin ve son kontrolden sonra kayda aktarın.
          </span>
        </div>

        <div className="operationActions">
          <Link href="/">Dashboard</Link>
          <Link href="/gruplar">Grupları Yönet</Link>
          <Link href="/on-kayit" target="_blank">
            Formu Aç
          </Link>
          <Link href="/ayarlar/on-kayit-formu">Form Ayarları</Link>
          <CopyLinkButton url={formUrl} />
        </div>
      </header>

      <section className="operationStats preRegistrationStats">
        <article>
          <span>Bekleyen Başvuru</span>
          <strong>{list.length}</strong>
        </article>
        <article>
          <span>Bugün Gelen</span>
          <strong>{todayCount}</strong>
        </article>
        <article>
          <span>Form Arşivi</span>
          <strong>{consentList.length}</strong>
        </article>
        <article>
          <span>Form Durumu</span>
          <strong style={{ fontSize: 16, color: "#16875b" }}>Aktif</strong>
        </article>
      </section>

      {params.updated === "1" && (
        <div className="preRegistrationFlash" role="status">
          ✓ Ön kayıt bilgileri güncellendi ve işlem geçmişine kaydedildi.
        </div>
      )}

      <PreRegistrationCenter
        students={list}
        branches={branches || []}
        groups={groups || []}
        packages={packages || []}
        consents={consentList}
        activities={activityList}
        initialSelectedId={initialSelectedId}
      />
    </main>
  );
}
