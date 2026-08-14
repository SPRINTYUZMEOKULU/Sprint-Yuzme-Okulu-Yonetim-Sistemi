import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type UnifiedApprovalRequest = {
  id: string;
  source: "student_status" | "lesson_adjustment";
  category: "student" | "lesson";
  request_type: string;

  student_id: string | null;
  branch_id: string | null;
  group_id: string | null;

  lesson_count: number | null;

  reason: string | null;
  description: string | null;

  old_status: string | null;
  new_status: string | null;
  requested_status: string | null;

  status: string;

  requested_by: string | null;
  requested_at: string | null;
  created_at: string | null;

  student: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    guardian_phone: string | null;
    branch_id: string | null;
    group_id: string | null;
  } | null;
};

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

    const [
      statusRequestResult,
      lessonRequestResult,
    ] = await Promise.all([
      supabase
        .from("student_status_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),

      supabase
        .from("lesson_adjustment_requests")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: false }),
    ]);

    if (statusRequestResult.error) {
      console.error(
        "student status approval list error:",
        statusRequestResult.error
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Öğrenci durum talepleri alınamadı.",
          details: statusRequestResult.error.message,
        },
        { status: 500 }
      );
    }

    if (lessonRequestResult.error) {
      console.error(
        "lesson approval list error:",
        lessonRequestResult.error
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Ders işlem talepleri alınamadı.",
          details: lessonRequestResult.error.message,
        },
        { status: 500 }
      );
    }

    const statusRequests =
      statusRequestResult.data ?? [];

    const lessonRequests =
      lessonRequestResult.data ?? [];

    const studentIds = Array.from(
      new Set(
        [
          ...statusRequests.map(
            (item) => item.student_id
          ),
          ...lessonRequests.map(
            (item) => item.student_id
          ),
        ].filter(
          (id): id is string =>
            typeof id === "string" &&
            id.length > 0
        )
      )
    );

    const studentsResult =
      studentIds.length > 0
        ? await supabase
            .from("students")
            .select(
              `
                id,
                first_name,
                last_name,
                phone,
                guardian_phone,
                branch_id,
                group_id
              `
            )
            .in("id", studentIds)
        : { data: [], error: null };

    if (studentsResult.error) {
      console.error(
        "approval center students error:",
        studentsResult.error
      );
    }

    const studentMap = new Map(
      (studentsResult.data ?? []).map(
        (student) => [
          student.id,
          student,
        ]
      )
    );

    const unifiedStatusRequests: UnifiedApprovalRequest[] =
      statusRequests.map((item) => ({
        id: item.id,
        source: "student_status",
        category: "student",
        request_type:
          item.request_type ?? "status_change",

        student_id: item.student_id ?? null,
        branch_id: item.branch_id ?? null,
        group_id: item.group_id ?? null,

        lesson_count: null,

        reason: item.reason ?? null,
        description: item.description ?? null,

        old_status: item.old_status ?? null,
        new_status: item.new_status ?? null,
        requested_status:
          item.requested_status ?? null,

        status: item.status ?? "pending",

        requested_by:
          item.requested_by ?? null,
        requested_at:
          item.requested_at ?? null,
        created_at:
          item.created_at ?? null,

        student: item.student_id
          ? studentMap.get(item.student_id) ??
            null
          : null,
      }));

    const unifiedLessonRequests: UnifiedApprovalRequest[] =
      lessonRequests.map((item) => ({
        id: item.id,
        source: "lesson_adjustment",
        category: "lesson",
        request_type:
          item.request_type ??
          "lesson_adjustment",

        student_id: item.student_id ?? null,
        branch_id: item.branch_id ?? null,
        group_id: item.group_id ?? null,

        lesson_count:
          item.lesson_count ?? null,

        reason: item.reason ?? null,
        description: item.description ?? null,

        old_status: null,
        new_status: null,
        requested_status: null,

        status: item.status ?? "pending",

        requested_by:
          item.requested_by ?? null,
        requested_at:
          item.requested_at ?? null,
        created_at:
          item.created_at ?? null,

        student: item.student_id
          ? studentMap.get(item.student_id) ??
            null
          : null,
      }));

    const requests = [
      ...unifiedStatusRequests,
      ...unifiedLessonRequests,
    ].sort((a, b) => {
      const aDate =
        a.requested_at ??
        a.created_at ??
        "";

      const bDate =
        b.requested_at ??
        b.created_at ??
        "";

      return (
        new Date(bDate).getTime() -
        new Date(aDate).getTime()
      );
    });

    return NextResponse.json({
      ok: true,
      counts: {
        total: requests.length,
        student:
          unifiedStatusRequests.length,
        lesson:
          unifiedLessonRequests.length,
      },
      requests,
    });
  } catch (error) {
    console.error(
      "approval-center GET error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Onay Merkezi talepleri alınırken beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
