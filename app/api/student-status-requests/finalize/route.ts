import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase servis anahtarı bulunamadı.");
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireManager() {
  const profile = await requireProfile(["owner", "admin"]);
  if (!profile.organization_id) throw new Error("Kurum bilgisi bulunamadı.");
  return profile;
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireManager();
    const supabase = await createClient();
    const requestId = request.nextUrl.searchParams.get("id") || "";

    let query = supabase
      .from("student_status_change_requests")
      .select("id,student_id,reason,description,status,request_type,requested_by,created_at,requested_at")
      .eq("organization_id", profile.organization_id)
      .eq("request_type", "deactivate")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (requestId) query = query.eq("id", requestId);

    const { data: requests, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: "Onaylı arşiv kayıtları alınamadı.", details: error.message }, { status: 500 });
    }

    const studentIds = Array.from(new Set((requests || []).map((row: any) => row.student_id).filter(Boolean)));
    const { data: students } = studentIds.length
      ? await supabase
          .from("students")
          .select("id,first_name,last_name,status,branch_id")
          .eq("organization_id", profile.organization_id)
          .in("id", studentIds)
      : { data: [] as any[] };

    const studentMap = new Map((students || []).map((student: any) => [student.id, student]));
    const items = (requests || []).map((row: any) => ({
      ...row,
      student: studentMap.get(row.student_id) || null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "İşlem yapılamadı." },
      { status: 403 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireManager();
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    const deleteAll = body.all === true;

    if (!deleteAll && ids.length === 0) {
      return NextResponse.json({ ok: false, error: "Silinecek onay kaydı seçilmedi." }, { status: 400 });
    }

    const admin = adminClient();
    let query = admin
      .from("student_status_change_requests")
      .select("id,student_id,status,request_type,reason,requested_by")
      .eq("organization_id", profile.organization_id)
      .eq("request_type", "deactivate")
      .eq("status", "approved");

    if (!deleteAll) query = query.in("id", ids);

    const { data: approvedRequests, error: requestError } = await query;
    if (requestError) {
      return NextResponse.json({ ok: false, error: "Onaylı kayıtlar doğrulanamadı.", details: requestError.message }, { status: 500 });
    }

    if (!approvedRequests?.length) {
      return NextResponse.json({ ok: false, error: "Kalıcı silmeye uygun onaylı kayıt bulunamadı." }, { status: 404 });
    }

    const deleted: Array<{ requestId: string; studentId: string }> = [];
    const failed: Array<{ requestId: string; studentId: string; error: string }> = [];

    for (const row of approvedRequests) {
      const studentId = String(row.student_id || "");
      if (!studentId) continue;

      const { data: student, error: lookupError } = await admin
        .from("students")
        .select("id,status")
        .eq("id", studentId)
        .eq("organization_id", profile.organization_id)
        .maybeSingle();

      if (lookupError || !student) {
        // Öğrenci zaten silinmişse talep kaydını da temizleyip tamamlanmış kabul et.
        await admin.from("student_status_change_requests").delete().eq("id", row.id);
        deleted.push({ requestId: row.id, studentId });
        continue;
      }

      if (student.status !== "passive") {
        failed.push({ requestId: row.id, studentId, error: "Öğrenci pasif durumda değil." });
        continue;
      }

      const { error: deleteError } = await admin
        .from("students")
        .delete()
        .eq("id", studentId)
        .eq("organization_id", profile.organization_id);

      if (deleteError) {
        failed.push({ requestId: row.id, studentId, error: deleteError.message });
        continue;
      }

      // FK cascade yoksa onay talebinin onaylı kaydı arayüzden ayrıca temizlensin.
      await admin.from("student_status_change_requests").delete().eq("id", row.id);
      deleted.push({ requestId: row.id, studentId });
    }

    return NextResponse.json({
      ok: failed.length === 0,
      deleted,
      failed,
      message:
        failed.length === 0
          ? `${deleted.length} onaylı pasif öğrenci kalıcı olarak silindi.`
          : `${deleted.length} kayıt silindi, ${failed.length} kayıt silinemedi.`,
    }, { status: failed.length === 0 ? 200 : 207 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Kalıcı silme işlemi yapılamadı." },
      { status: 403 },
    );
  }
}
