import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { requireProfile } from "@/lib/auth/profile";

const ROLES = ["owner","admin","branch_manager","registration_staff","accounting","coach"] as const;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    const body = await request.json();
    const studentId = String(body.studentId || "");
    const year = Number(body.year || new Date().getFullYear());

    if (!organizationId || !studentId || !Number.isInteger(year)) {
      return NextResponse.json({ ok: false, error: "Doğum günü kaydı için öğrenci/yıl bilgisi eksik." }, { status: 400 });
    }

    const supabase = adminClient();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id,first_name,last_name")
      .eq("organization_id", organizationId)
      .eq("id", studentId)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json({ ok: false, error: "Öğrenci bulunamadı." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("birthday_celebrations")
      .upsert({
        organization_id: organizationId,
        student_id: studentId,
        celebration_year: year,
        status: "sent",
        channel: "whatsapp",
        sent_at: now,
        sent_by: profile.id,
        updated_at: now,
      }, { onConflict: "organization_id,student_id,celebration_year" })
      .select("id,sent_at,sent_by")
      .single();

    if (error) throw error;

    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    await supabase.from("student_activity_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      activity_type: "birthday_celebrated",
      title: "Doğum günü kutlandı",
      description: `${fullName} için WhatsApp doğum günü kutlaması kaydedildi.`,
      source_type: "birthday_celebration",
      source_id: data.id,
      performed_by: profile.id,
      performed_at: now,
      new_value: { celebration_year: year, channel: "whatsapp", sent_at: now },
    });

    return NextResponse.json({ ok: true, celebration: data, message: "Doğum günü kutlandı olarak kaydedildi." });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Doğum günü kutlaması kaydedilemedi." }, { status: 500 });
  }
}
