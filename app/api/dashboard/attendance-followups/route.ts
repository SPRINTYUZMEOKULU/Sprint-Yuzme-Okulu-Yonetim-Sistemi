import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";
import { historyStart } from "@/lib/dashboard/past-attendance";
import { validFollowup } from "@/lib/dashboard/attendance-followup";

export async function POST(request: NextRequest) {
  // The request uses cookie authentication. Reject cross-origin mutations.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 403 });
  }
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
  if (!profile.organization_id) return NextResponse.json({ ok: false, error: "Kurum bilgisi bulunamadı." }, { status: 400 });
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz işlem." }, { status: 400 });
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!validFollowup(body, today, historyStart(today))) {
    return NextResponse.json({ ok: false, error: "Geçmiş seans veya işlem bilgisi geçersiz." }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "İşlem kaydı bağlantısı yapılandırılmamış." }, { status: 503 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: branch, error: branchError } = await admin.from("branches").select("id")
    .eq("organization_id", profile.organization_id).eq("id", body.branchId).maybeSingle();
  if (branchError) return NextResponse.json({ ok: false, error: "Şube kontrolü yapılamadı." }, { status: 503 });
  if (!branch) return NextResponse.json({ ok: false, error: "Şube bulunamadı." }, { status: 404 });
  const { data, error } = await admin.from("attendance_followups").upsert({
    organization_id: profile.organization_id, branch_id: body.branchId,
    lesson_date: body.date, start_time: body.time, status: body.status,
    updated_by: profile.id, updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,branch_id,lesson_date,start_time" })
    .select("status,updated_at").single();
  if (error) {
    console.error("Geçmiş yoklama takip kaydı:", error);
    return NextResponse.json({ ok: false, error: "İşlem kaydedilemedi. Tekrar deneyin." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, status: data.status, updatedAt: data.updated_at });
}
