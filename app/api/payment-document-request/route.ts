import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Oturum gerekli." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id,role").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id || !["owner","admin","branch_manager","registration_staff","accounting"].includes(profile.role)) {
    return NextResponse.json({ message: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = String(body?.studentId || "");
  const expectedAmount = body?.expectedAmount == null || body?.expectedAmount === "" ? null : Number(body.expectedAmount);
  if (!studentId || (expectedAmount != null && (!Number.isFinite(expectedAmount) || expectedAmount <= 0))) {
    return NextResponse.json({ message: "Ödeme talebi bilgileri geçersiz." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ message: "Sistem bağlantısı yapılandırılmamış." }, { status: 500 });
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: student } = await admin.from("students").select("id").eq("id", studentId).eq("organization_id", profile.organization_id).maybeSingle();
  if (!student) return NextResponse.json({ message: "Kursiyer bulunamadı." }, { status: 404 });

  const { data: enrollment } = await admin.from("student_enrollments").select("id").eq("student_id", studentId).eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: row, error } = await admin.from("payment_document_requests").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    enrollment_id: enrollment?.id || null,
    payment_method: "bank_transfer",
    expected_amount: expectedAmount,
    status: "waiting_customer",
    created_by: user.id,
  }).select("public_token,expires_at").single();
  if (error || !row) return NextResponse.json({ message: "Güvenli ödeme bağlantısı oluşturulamadı." }, { status: 500 });

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/odeme-belge/${row.public_token}`, expiresAt: row.expires_at });
}
