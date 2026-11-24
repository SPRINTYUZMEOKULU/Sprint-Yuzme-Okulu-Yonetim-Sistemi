import { revalidateStudentSurfaces } from "@/lib/students/revalidate";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishEventNotification } from "@/lib/notifications/publish-event";
import { publishEnrollmentFreeze } from "@/lib/messaging/publish-enrollment-freeze";
import { enrollmentFreezeMessage } from "@/lib/messaging/enrollment-freeze-message";

const roles = ["owner", "admin", "branch_manager", "registration_staff"];
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;

async function context() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { db, profile: null };
  const { data: profile } = await db.from("profiles").select("id,organization_id,role,is_active")
    .eq("id", user.id).maybeSingle();
  return { db, profile: profile?.is_active && roles.includes(profile.role) ? profile : null };
}

export async function GET(request: NextRequest) {
  const { db, profile } = await context();
  if (!profile?.organization_id) return NextResponse.json({ error: "Yetkiniz bulunmuyor." }, { status: 403 });
  const student = request.nextUrl.searchParams.get("student") || "";
  if (!uuid.test(student)) return NextResponse.json({ error: "Kursiyer bulunamadı." }, { status: 400 });
  const { data, error } = await db.from("approval_requests").select("id,status,new_values,entity_id")
    .eq("organization_id", profile.organization_id).eq("student_id", student)
    .eq("request_type", "enrollment_freeze").in("status", ["pending","approved"])
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Dondurma durumu yüklenemedi." }, { status: 500 });
  let restartPending = false;
  if (data?.status === "approved") {
    const result = await db.from("student_enrollments").select("freeze_restart_pending")
      .eq("organization_id", profile.organization_id).eq("student_id", student).eq("id", data.entity_id).maybeSingle();
    if (result.error) return NextResponse.json({ error: "Dondurma durumu yüklenemedi." }, { status: 500 });
    restartPending = result.data?.freeze_restart_pending === true;
  }
  return NextResponse.json({ item: data ? { ...data, restartPending } : null, canConfirm: ["owner", "admin"].includes(profile.role) });
}

export async function POST(request: NextRequest) {
  const { db, profile } = await context();
  if (!profile?.organization_id) return NextResponse.json({ error: "Yetkiniz bulunmuyor." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.action === "restart") {
    if (!["owner", "admin"].includes(profile.role)) return NextResponse.json({ error: "Yönetici yetkisi gerekiyor." }, { status: 403 });
    if (!uuid.test(body.enrollmentId || "")) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 400 });
    const { data: restart, error } = await db.rpc("restart_frozen_enrollment", { p_enrollment_id: body.enrollmentId });
    if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Kayıt başlatılamadı." }, { status: error.code === "42501" ? 403 : 409 });
    revalidateStudentSurfaces(restart.student_id);
    return NextResponse.json(restart);
  }
  const confirm = body?.action === "confirm_resume";
  const callback = !confirm && body?.callback === true;
  const recordId = confirm ? body?.requestId : body?.enrollmentId;
  if (!uuid.test(recordId || "") || (!confirm && !date.test(body?.start || "")) ||
      (!callback && !date.test(body?.resume || ""))) {
    return NextResponse.json({ error: "Dondurma ve dönüş tarihlerini kontrol edin." }, { status: 400 });
  }
  const { data: item, error } = await db.rpc("process_enrollment_freeze", {
    p_action: confirm ? "confirm_resume" : "request", p_id: recordId,
    p_start: confirm ? null : body.start, p_resume: callback ? null : body.resume,
    p_callback: callback, p_note: typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null,
  });
  if (error) {
    const message = error.code === "P0001" ? error.message : "Dondurma talebi kaydedilemedi.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  if (confirm) {
    revalidateStudentSurfaces(item.student_id);
    const delivery = await publishEnrollmentFreeze(profile.organization_id, profile.id, item);
    return NextResponse.json({ item: { ...item, status: "approved", restartPending: true }, delivery });
  }

  const [delivery, staff] = await Promise.all([
    publishEnrollmentFreeze(profile.organization_id, profile.id, item),
    publishEventNotification({
      organization_id: profile.organization_id, student_id: item.student_id, created_by: profile.id,
      category: "approvals", source_type: "approval_request", source_id: item.id,
      event_key: "enrollment_freeze_requested", title: "Kayıt dondurma onayı bekliyor",
      message: "Kursiyer için kayıt dondurma talebi oluşturuldu.", priority: "high",
      target_path: `/onay-merkezi?requestId=${item.id}`,
    }),
  ]);
  return NextResponse.json({ item, delivery, staffWarning: staff.error?.message,
    message: enrollmentFreezeMessage(item.status, item.new_values) }, { status: 201 });
}
