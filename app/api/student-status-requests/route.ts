import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RequestBody = {
  request_type: "deactivate";

  student_id: string;
  branch_id?: string | null;
  group_id?: string | null;

  reason: string;
  description?: string;

  old_status?: string;
  new_status?: string;
};

function clean(value: unknown, max = 500) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const body = (await request.json()) as RequestBody;

    const studentId = clean(body.student_id, 60);
    const branchId = clean(body.branch_id, 60);
    const groupId = clean(body.group_id, 60);

    const reason = clean(body.reason, 250);
    const description = clean(body.description, 1000);

    const oldStatus = clean(body.old_status, 50) || "active";
    const newStatus = clean(body.new_status, 50) || "passive";

    if (!studentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Öğrenci bilgisi bulunamadı.",
        },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pasife alma gerekçesi seçilmelidir.",
        },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Oturum bulunamadı.",
        },
        { status: 401 }
      );
    }
    const { data: studentRecord, error: studentError } = await supabase
  .from("students")
  .select("organization_id")
  .eq("id", studentId)
  .single();

if (studentError || !studentRecord?.organization_id) {
  console.error("Öğrenci organizasyon bilgisi alınamadı:", studentError);

  return NextResponse.json(
    {
      ok: false,
      error: "Öğrencinin organizasyon bilgisi bulunamadı.",
      details: studentError?.message,
    },
    { status: 400 }
  );
}

const organizationId = studentRecord.organization_id;

    const { data: existingRequest, error: existingError } = await supabase
      .from("student_status_change_requests")
      .select("id")
      .eq("student_id", studentId)
      .eq("request_type", "deactivate")
      .eq("status", "pending")
      .maybeSingle();

    if (existingError) {
      console.error(existingError);

      return NextResponse.json(
        {
          ok: false,
          error: "Bekleyen talepler kontrol edilemedi.",
          details: existingError.message,
        },
        { status: 500 }
      );
    }

    if (existingRequest) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bu öğrenci için zaten yönetici onayı bekleyen bir pasife alma talebi bulunmaktadır.",
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("student_status_change_requests")
      .insert({
        request_type: "deactivate",
        student_id: studentId,
        organization_id: organizationId,
        branch_id: branchId || null,
        group_id: groupId || null,

        reason,
        description: description || null,

        old_status: oldStatus,
        new_status: newStatus,

        status: "pending",
        requested_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          ok: false,
          error: "Pasife alma talebi oluşturulamadı.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Pasife alma talebi yönetici onayına gönderildi.",
      request: data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error: "Sunucuda beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}  
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Oturum bulunamadı.",
        },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("student_status_change_requests")
      .select(
        `
        id,
        request_type,
        student_id,
        branch_id,
        group_id,
        reason,
        description,
        old_status,
        new_status,
        status,
        requested_by
        `
      )
      .eq("status", "pending")
      .eq("request_type", "deactivate");

    if (error) {
      console.error("status request list error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Onay bekleyen pasife alma talepleri alınamadı.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      requests: data ?? [],
    });
  } catch (error) {
    console.error("status request GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Sunucuda beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
