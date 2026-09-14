import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const studentId = request.nextUrl.searchParams.get("studentId")?.trim() || "";
  if (!profile.organization_id || !studentId) {
    return NextResponse.json({ ok: false, relationship: "" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ ok: false, relationship: "" }, { status: 404 });
  }

  const { data: link } = await supabase
    .from("guardian_students")
    .select("relationship,is_primary")
    .eq("student_id", studentId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    relationship: link?.relationship || "",
  });
}
