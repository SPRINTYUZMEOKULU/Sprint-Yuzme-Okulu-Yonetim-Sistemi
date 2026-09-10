import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
] as const;

export async function GET() {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return NextResponse.json({ ok: true, students: [] });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .select("id,student_number,registration_source,status")
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .eq("registration_source", "excel_import");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      students: (data || []).map((student) => ({
        id: student.id,
        studentNumber: student.student_number || null,
        status: student.status || null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Aktarılan öğrenci bilgileri yüklenemedi.",
      },
      { status: 500 },
    );
  }
}
