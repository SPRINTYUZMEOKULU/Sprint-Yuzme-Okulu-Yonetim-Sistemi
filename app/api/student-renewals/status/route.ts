import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    const studentId = String(request.nextUrl.searchParams.get("studentId") || "");
    const requestId = String(request.nextUrl.searchParams.get("requestId") || "");

    if (!organizationId || !studentId) {
      return NextResponse.json({ ok: false, error: "Öğrenci bilgisi eksik." }, { status: 400 });
    }

    const supabase = await createClient();
    let query = supabase
      .from("approval_requests")
      .select("id,student_id,status,reason,new_values,metadata,requested_at,created_at,reviewed_at")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .eq("request_type", "registration_custom_lesson_count")
      .order("created_at", { ascending: false })
      .limit(30);

    if (requestId) query = query.eq("id", requestId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data || []).filter((row: any) => {
      const meta = asObject(row.metadata);
      return meta.source === "student_renewal_center";
    });

    const openRows = rows.filter((row: any) => {
      const meta = asObject(row.metadata);
      return row.status === "pending" || (row.status === "approved" && !meta.consumed_at);
    });

    const selected = openRows[0] || null;
    const next = selected ? asObject(selected.new_values) : {};
    const meta = selected ? asObject(selected.metadata) : {};

    return NextResponse.json({
      ok: true,
      openCount: openRows.length,
      request: selected
        ? {
            id: selected.id,
            status: selected.status,
            reason: selected.reason || null,
            totalLessons: Number(next.total_lessons || 0) || null,
            packageId: next.package_id || null,
            groupId: next.group_id || null,
            branchId: next.branch_id || null,
            startDate: next.start_date || null,
            paymentDueDate: next.payment_due_date || null,
            note: meta.note || null,
            requestedAt: selected.requested_at || selected.created_at || null,
            reviewedAt: selected.reviewed_at || null,
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Yenileme durumu alınamadı." },
      { status: 500 },
    );
  }
}
