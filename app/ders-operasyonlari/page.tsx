import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import LessonOperationsClient from "./lesson-operations-client";
import OperationSelectionHydrator from "./operation-selection-hydrator";
import "../dashboard.css";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseStudentIds(value?: string) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => UUID_RE.test(id))
    )
  ).slice(0, 200);
}

export default async function LessonOperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
  ]);

  const query = await searchParams;
  const requestedStudentIds = parseStudentIds(query.studentIds);
  const supabase = await createClient();
  const organizationId = profile.organization_id;

  if (!organizationId) {
    return <main className="operationPage"><section className="operationCard">Organizasyon bilgisi bulunamadı.</section></main>;
  }

  const [branchesResult, groupsResult, schedulesResult, membershipsResult, selectedStudentsResult] = await Promise.all([
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
    requestedStudentIds.length
      ? supabase
          .from("students")
          .select("id,first_name,last_name,status")
          .eq("organization_id", organizationId)
          .eq("status", "active")
          .in("id", requestedStudentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const memberCounts: Record<string, number> = {};
  for (const row of membershipsResult.data || []) {
    if (!row.group_id || !row.student_id) continue;
    memberCounts[row.group_id] = (memberCounts[row.group_id] || 0) + 1;
  }

  const validSelectedIds = new Set((selectedStudentsResult.data || []).map((row: any) => row.id));
  const selectedStudentIds = requestedStudentIds.filter((id) => validSelectedIds.has(id));
  const selectedMemberships = (membershipsResult.data || []).filter((row: any) => selectedStudentIds.includes(row.student_id));
  const selectedGroupIds = Array.from(new Set(selectedMemberships.map((row: any) => row.group_id).filter(Boolean)));
  const groupMap = new Map((groupsResult.data || []).map((row: any) => [row.id, row]));
  const selectedGroupNames = selectedGroupIds.map((id) => groupMap.get(id)?.name).filter(Boolean);
  const initialGroupId = selectedGroupIds.length === 1 ? String(selectedGroupIds[0]) : "";
  const initialBranchId = initialGroupId ? String(groupMap.get(initialGroupId)?.branch_id || "") : "";

  return (
    <main style={{ minHeight: "100vh", padding: "24px", background: "#f4f7fb" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <Link href="/ogrenciler" style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #dbe4f0", textDecoration: "none", color: "#17345c", fontWeight: 800 }}>← Öğrenci Merkezi</Link>
          <Link href="/yoklama" style={{ padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #dbe4f0", textDecoration: "none", color: "#17345c", fontWeight: 800 }}>Yoklama</Link>
          <Link href="/" style={{ padding: "10px 14px", borderRadius: 10, background: "#1671e8", textDecoration: "none", color: "#fff", fontWeight: 800 }}>Ana Sayfa</Link>
        </div>

        {selectedStudentIds.length ? (
          <section style={{ marginBottom: 16, padding: 16, borderRadius: 16, border: "1px solid #bfd6f2", background: "#eef6ff", color: "#17345c" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <strong style={{ display: "block", fontSize: 16 }}>{selectedStudentIds.length} seçili kursiyer operasyon merkezine aktarıldı</strong>
                <span style={{ fontSize: 12, color: "#657a93" }}>İşlem uygulandığında yalnız bu seçili kursiyerler hedeflenir.</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: selectedGroupIds.length > 1 ? "#a04a00" : "#17643c" }}>
                {selectedGroupIds.length === 1 ? `Grup: ${selectedGroupNames[0] || "—"}` : `${selectedGroupIds.length} farklı grup seçili`}
              </span>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {(selectedStudentsResult.data || []).slice(0, 20).map((student: any) => (
                <span key={student.id} style={{ padding: "6px 9px", borderRadius: 999, background: "#fff", border: "1px solid #d3e3f6", fontSize: 12, fontWeight: 700 }}>
                  {student.first_name} {student.last_name}
                </span>
              ))}
              {selectedStudentIds.length > 20 ? <span style={{ padding: "6px 9px", fontSize: 12 }}>+{selectedStudentIds.length - 20} kişi</span> : null}
            </div>
          </section>
        ) : null}

        <LessonOperationsClient
          branches={branchesResult.data || []}
          groups={groupsResult.data || []}
          schedules={schedulesResult.data || []}
          memberCounts={memberCounts}
        />
        {initialBranchId && initialGroupId ? (
          <OperationSelectionHydrator branchId={initialBranchId} groupId={initialGroupId} />
        ) : null}
      </div>
    </main>
  );
}
