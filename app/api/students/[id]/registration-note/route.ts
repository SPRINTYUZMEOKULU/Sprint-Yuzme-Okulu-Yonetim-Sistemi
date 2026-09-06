import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select("id,registration_note,registration_source,created_at")
    .eq("organization_id", profile.organization_id)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Ön kayıt notu okunamadı." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Öğrenci bulunamadı." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    note: data.registration_note || null,
    source: data.registration_source || null,
    createdAt: data.created_at || null,
  });
}
