import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
] as const;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await requireProfile([...ROLES]);
    if (!profile.organization_id) {
      return NextResponse.json({ ok: true, notifications: [] });
    }

    const supabase = await createClient();
    const manager = ["owner", "admin"].includes(String((profile as any).role || ""));
    const recipientFilter = manager
      ? `recipient_profile_id.eq.${profile.id},recipient_user_id.eq.${profile.id},and(recipient_profile_id.is.null,recipient_user_id.is.null)`
      : `recipient_profile_id.eq.${profile.id},recipient_user_id.eq.${profile.id}`;

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("system_notifications")
      .select("id,title,body,message,severity,priority,event_key,target_path,student_id,entity_id,metadata,created_at,is_read")
      .eq("organization_id", profile.organization_id)
      .eq("is_read", false)
      .gte("created_at", since)
      .or(recipientFilter)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = data || [];
    const approvalIds = rows
      .filter((row: any) => row.event_key === "registration_custom_lesson_count_approved" && row.entity_id)
      .map((row: any) => row.entity_id as string);

    const approvalSource = new Map<string, string>();
    if (approvalIds.length) {
      const { data: approvals } = await supabase
        .from("approval_requests")
        .select("id,metadata")
        .eq("organization_id", profile.organization_id)
        .in("id", approvalIds);

      for (const approval of approvals || []) {
        const metadata = approval.metadata && typeof approval.metadata === "object" ? approval.metadata : {};
        approvalSource.set(approval.id, String((metadata as any).source || ""));
      }
    }

    const notifications = rows.map((row: any) => {
      let targetPath = row.target_path || "/bildirimler";
      if (
        row.event_key === "registration_custom_lesson_count_approved" &&
        row.student_id &&
        row.entity_id &&
        approvalSource.get(row.entity_id) === "student_renewal_center"
      ) {
        targetPath = `/ogrenciler/${row.student_id}?renewalApproval=approved`;
      }

      return {
        id: row.id,
        title: row.title || "SprintOS Bildirimi",
        body: row.body || row.message || "Yeni bir işlem bildirimi var.",
        severity: row.severity || "info",
        priority: row.priority || "normal",
        eventKey: row.event_key || null,
        targetPath,
        createdAt: row.created_at,
      };
    });

    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bildirimler alınamadı." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const body = await request.json();
    const id = String(body.id || "");
    if (!profile.organization_id || !id) {
      return NextResponse.json({ ok: false, error: "Bildirim bilgisi eksik." }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("system_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("organization_id", profile.organization_id)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bildirim güncellenemedi." },
      { status: 500 },
    );
  }
}
