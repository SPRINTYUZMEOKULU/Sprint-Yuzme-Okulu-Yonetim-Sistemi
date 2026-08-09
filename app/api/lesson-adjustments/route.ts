import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AdjustmentType =
  | "individual_compensation"
  | "bulk_compensation"
  | "lesson_count_change";

type AdjustmentScope = "student" | "branch";

type AdjustmentBody = {
  adjustment_type?: AdjustmentType;
  scope?: AdjustmentScope;

  student_id?: string | null;
  branch_id?: string | null;

  lesson_count?: number;
  reason?: string;

  requested_by?: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validLessonCount(value: unknown) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number > 0 &&
    number <= 100
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const body = (await request.json()) as AdjustmentBody;

    const adjustmentType = body.adjustment_type;
    const scope = body.scope;

    const studentId = cleanText(body.student_id);
    const branchId = cleanText(body.branch_id);
    const reason = cleanText(body.reason);

    const lessonCount = Number(body.lesson_count);

    if (
      adjustmentType !== "individual_compensation" &&
      adjustmentType !== "bulk_compensation" &&
      adjustmentType !== "lesson_count_change"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz işlem türü.",
        },
        { status: 400 }
      );
    }

    if (scope !== "student" && scope !== "branch") {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz işlem kapsamı.",
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

    if (scope === "student" && !studentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Öğrenci seçilmelidir.",
        },
        { status: 400 }
      );
    }

    if (scope === "branch" && !branchId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Şube seçilmelidir.",
        },
        { status: 400 }
      );
    }

    if (
      adjustmentType === "individual_compensation" &&
      scope !== "student"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bireysel telafi yalnızca öğrenciye eklenebilir.",
        },
        { status: 400 }
      );
    }

    if (
      adjustmentType === "bulk_compensation" &&
      scope !== "branch"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Toplu telafi şube üzerinden uygulanmalıdır.",
        },
        { status: 400 }
      );
    }

    /*
      ÖNEMLİ:
      Burada ders hakkını doğrudan değiştirmiyoruz.

      Önce yönetici onay talebi oluşturuyoruz.
      Onay verildiğinde ayrı işlem üzerinden
      öğrencinin ders hakları güncellenecek.
    */

    const { data, error } = await supabase
      .from("lesson_adjustment_requests")
      .insert({
        adjustment_type: adjustmentType,
        scope,

        student_id:
          scope === "student"
            ? studentId
            : null,

        branch_id:
          scope === "branch"
            ? branchId
            : null,

        lesson_count: lessonCount,
        reason,

        status: "pending",

        requested_by:
          cleanText(body.requested_by) || null,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "lesson adjustment request error:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error: "İşlem talebi kaydedilemedi.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        adjustmentType === "individual_compensation"
          ? "Bireysel telafi talebi yönetici onayına gönderildi."
          : adjustmentType === "bulk_compensation"
          ? "Şube toplu telafi talebi yönetici onayına gönderildi."
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
      .order("created_at", {
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
