import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
] as const;

export async function GET(request: NextRequest) {
  const profile = await requireProfile([...allowedRoles]);
  const organizationId = profile.organization_id;
  const groupId = request.nextUrl.searchParams.get("group_id")?.trim() || "";

  if (!organizationId || !groupId) {
    return NextResponse.json(
      { ok: false, message: "Grup bilgisi eksik.", schedules: [] },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: group, error: groupError } = await supabase
    .from("training_groups")
    .select("id,branch_id,is_active")
    .eq("organization_id", organizationId)
    .eq("id", groupId)
    .eq("is_active", true)
    .maybeSingle();

  if (groupError) {
    return NextResponse.json(
      { ok: false, message: groupError.message, schedules: [] },
      { status: 500 }
    );
  }

  if (!group?.branch_id) {
    return NextResponse.json({ ok: true, schedules: [] });
  }

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id,is_active")
    .eq("organization_id", organizationId)
    .eq("id", group.branch_id)
    .eq("is_active", true)
    .maybeSingle();

  if (branchError) {
    return NextResponse.json(
      { ok: false, message: branchError.message, schedules: [] },
      { status: 500 }
    );
  }

  if (!branch) {
    return NextResponse.json({ ok: true, schedules: [] });
  }

  const { data, error } = await supabase
    .from("lesson_schedules")
    .select("id,group_id,weekday,start_time,end_time")
    .eq("organization_id", organizationId)
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message, schedules: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    schedules: (data || []).map((item) => ({
      id: item.id,
      weekday: Number(item.weekday),
      start_time: String(item.start_time || ""),
      end_time: String(item.end_time || ""),
    })),
  });
}
