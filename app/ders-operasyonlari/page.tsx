import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import LessonOperationsClient from "./lesson-operations-client";
import "../dashboard.css";

export const dynamic = "force-dynamic";

export default async function LessonOperationsPage() {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
  ]);

  const supabase = await createClient();
  const organizationId = profile.organization_id;

  if (!organizationId) {
    return <main className="operationPage"><section className="operationCard">Organizasyon bilgisi bulunamadı.</section></main>;
  }

  const [branchesResult, groupsResult, schedulesResult, membershipsResult] = await Promise.all([
    supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("training_groups")
      .select("id,name,branch_id,course_type")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("lesson_schedules")
      .select("id,group_id,branch_id,weekday,start_time,end_time,is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("student_group_memberships")
      .select("group_id,student_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  const memberCounts: Record<string, number> = {};
  for (const row of membershipsResult.data || []) {
    if (!row.group_id || !row.student_id) continue;
    memberCounts[row.group_id] = (memberCounts[row.group_id] || 0) + 1;
  }

  return (
    <main style={{ minHeight: "100vh", padding: "24px", background: "#f4f7fb" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/ogrenciler" style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #dbe4f0", textDecoration: "none", color: "#17345c", fontWeight: 800 }}>← Öğrenci Merkezi</Link>
          <Link href="/yoklama" style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #dbe4f0", textDecoration: "none", color: "#17345c", fontWeight: 800 }}>Yoklama</Link>
          <Link href="/" style={{ padding: "10px 14px", borderRadius: 10, background: "#1671e8", textDecoration: "none", color: "#fff", fontWeight: 800 }}>Ana Sayfa</Link>
        </div>

        <LessonOperationsClient
          branches={branchesResult.data || []}
          groups={groupsResult.data || []}
          schedules={schedulesResult.data || []}
          memberCounts={memberCounts}
        />
      </div>
    </main>
  );
}
