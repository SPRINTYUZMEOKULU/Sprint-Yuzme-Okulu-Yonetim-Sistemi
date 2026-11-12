import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RequestType =
  | "individual_compensation"
  | "bulk_compensation"
  | "lesson_count_change";

type RequestBody = {
  request_type?: RequestType;

  student_id?: string | null;
  branch_id?: string | null;
  group_id?: string | null;

  lesson_count?: number;

  reason?: string;
  description?: string;
};

function clean(value: unknown, max = 500) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function validLessonCount(value: unknown) {
  const count = Number(value);

  return (
    Number.isInteger(count) &&
    count > 0 &&
    count <= 100
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Oturum bulunamadı. Lütfen yeniden giriş yapın." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.organization_id || !profile.is_active) {
      return NextResponse.json({ ok: false, error: "Aktif personel veya kurum yetkisi bulunamadı." }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;

    const requestType = body.request_type;
    const studentId = clean(body.student_id, 60);
    const branchId = clean(body.branch_id, 60);
    const groupId = clean(body.group_id, 60);

    const reason = clean(body.reason, 250);
    const description = clean(body.description, 1000);

    const lessonCount = Number(body.lesson_count);

    if (
      requestType !== "individual_compensation" &&
      requestType !== "bulk_compensation" &&
      requestType !== "lesson_count_change"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz işlem türü.",
        },
        { status: 400 }
      );
    }

    if (!validLessonCount(lessonCount)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ders sayısı 1 ile 100 arasında olmalıdır.",
        },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        {
          ok: false,
          error: "İşlem gerekçesi zorunludur.",
        },
        { status: 400 }
      );
    }

    if (
      (requestType === "individual_compensation" ||
        requestType === "lesson_count_change") &&
      !studentId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Öğrenci seçilmelidir.",
        },
        { status: 400 }
      );
    }

    if (
      requestType === "bulk_compensation" &&
      !branchId &&
      !groupId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Toplu telafi için şube veya grup seçilmelidir.",
        },
        { status: 400 }
      );
    }

    // Kullanıcının kendi kurumu dışındaki öğrencilere işlem açılmasını engelle.
    if (studentId) {
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id")
        .eq("id", studentId)
        .eq("organization_id", profile.organization_id)
        .maybeSingle();

      if (studentError || !student) {
        return NextResponse.json({ ok: false, error: "Öğrenci kurumunuzda bulunamadı." }, { status: 404 });
      }
    }

    const { data, error } = await supabase
      .from("lesson_adjustment_requests")
      .insert({
        organization_id: profile.organization_id,

        request_type: requestType,

        student_id:
          requestType === "individual_compensation" ||
          requestType === "lesson_count_change"
            ? studentId
            : null,

        branch_id: branchId || null,
        group_id: groupId || null,

        lesson_count: lessonCount,

        reason,
        description: description || null,

        status: "pending",
        requested_by: user.id,
      })
      .select("id,status,request_type,lesson_count")
      .single();

    if (error) {
      console.error(
        "lesson adjustment insert error:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Talep oluşturulamadı.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        requestType === "individual_compensation"
          ? "Bireysel telafi yönetici onayına gönderildi."
          : requestType === "bulk_compensation"
          ? "Toplu telafi yönetici onayına gönderildi."
          : "Ders sayısı değişikliği yönetici onayına gönderildi.",
      request: data,
    });
  } catch (error) {
    console.error(
      "lesson-adjustments POST error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("lesson_adjustment_requests")
      .select("*")
      .order("requested_at", {
        ascending: false,
      })
      .limit(250);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      requests: data ?? [],
    });
  } catch (error) {
    console.error(
      "lesson-adjustments GET error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Talepler alınamadı.",
      },
      { status: 500 }
    );
  }
}
