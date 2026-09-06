import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import MessageCenter from "./message-center";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function ReadyMessagesPage() {
  const profile = await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);
  const organizationId = profile.organization_id;
  if (!organizationId) throw new Error("Organizasyon bilgisi bulunamadı.");
  const supabase = await createClient();

  const [branchesRes, groupsRes, schedulesRes, studentsRes, membershipsRes] = await Promise.all([
    supabase.from("branches").select("id,name,is_active").eq("organization_id",organizationId).eq("is_active",true).order("name"),
    supabase.from("training_groups").select("id,name,branch_id,course_type,is_active").eq("organization_id",organizationId).eq("is_active",true).order("name"),
    supabase.from("lesson_schedules").select("id,group_id,branch_id,weekday,start_time,end_time,is_active").eq("organization_id",organizationId).eq("is_active",true).order("weekday").order("start_time"),
    supabase.from("students").select("id,first_name,last_name,phone,guardian_phone,branch_id,preferred_group_id,status").eq("organization_id",organizationId).eq("status","active").order("first_name"),
    supabase.from("student_group_memberships").select("student_id,group_id,is_active").eq("organization_id",organizationId).eq("is_active",true),
  ]);

  const loadError = branchesRes.error || groupsRes.error || schedulesRes.error || studentsRes.error || membershipsRes.error;

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SPRİNT YÜZME OKULU · İLETİŞİM MERKEZİ</p>
          <h1>Hazır Mesajlar & Toplu İletişim</h1>
          <p>Şube, grup ve seans bazlı toplu mesaj hazırlayın; afiş ekleyin, WhatsApp görünümünü önizleyin ve hediye dersleri tek merkezden yönetin.</p>
        </div>
        <Link href="/" className={styles.back}>Yönetim paneline dön</Link>
      </section>

      {loadError ? (
        <div className={styles.error}>Veriler yüklenemedi: {loadError.message}</div>
      ) : (
        <MessageCenter
          branches={branchesRes.data || []}
          groups={groupsRes.data || []}
          schedules={schedulesRes.data || []}
          students={studentsRes.data || []}
          memberships={membershipsRes.data || []}
        />
      )}
    </main>
  );
}
