import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StudentInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  emergency_contact_phone: string | null;
  branch_id: string | null;
};

type UnifiedApprovalRequest = {
  id: string;

  source:
    | "student_status"
    | "lesson_adjustment";

  category:
    | "student"
    | "lesson";

  request_type: string;
  request_label: string;

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

  student: StudentInfo | null;

  recipient_phone: string | null;

  recipient_type:
    | "student"
    | "guardian"
    | "emergency"
    | null;

  suggested_message: string;
};

type ApprovalActionBody = {
  id?: string;
  source?: string;
  action?: string;
};

function clean(
  value: unknown,
  max = 100
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function requestLabel(
  source: string,
  requestType: string,
  requestedStatus?: string | null
) {
  if (source === "student_status") {
    if (
      requestType === "deactivate" ||
      requestedStatus === "passive"
    ) {
      return "Pasife Alma";
    }

    if (
      requestType === "activate" ||
      requestedStatus === "active"
    ) {
      return "Aktife Alma";
    }

    return "Öğrenci Durum Değişikliği";
  }

  if (
    requestType ===
    "individual_compensation"
  ) {
    return "Bireysel Telafi";
  }

  if (
    requestType ===
    "bulk_compensation"
  ) {
    return "Toplu Telafi";
  }

  if (
    requestType ===
    "lesson_count_change"
  ) {
    return "Ders Sayısı Değişikliği";
  }

  return "Ders İşlemi";
}

function getRecipient(
  student: StudentInfo | null
) {
  if (!student) {
    return {
      phone: null,
      type: null as
        | "student"
        | "guardian"
        | "emergency"
        | null,
    };
  }

  if (
    student.guardian_phone &&
    student.guardian_phone.trim()
  ) {
    return {
      phone:
        student.guardian_phone.trim(),
      type: "guardian" as const,
    };
  }

  if (
    student.phone &&
    student.phone.trim()
  ) {
    return {
      phone: student.phone.trim(),
      type: "student" as const,
    };
  }

  if (
    student.emergency_contact_phone &&
    student.emergency_contact_phone.trim()
  ) {
    return {
      phone:
        student.emergency_contact_phone.trim(),
      type: "emergency" as const,
    };
  }

  return {
    phone: null,
    type: null,
  };
}

function buildSuggestedMessage(params: {
  student: StudentInfo | null;
  requestType: string;
  source: string;
  lessonCount: number | null;
  requestedStatus: string | null;
}) {
  const {
    student,
    requestType,
    source,
    lessonCount,
    requestedStatus,
  } = params;

  const fullName = student
    ? `${student.first_name ?? ""} ${
        student.last_name ?? ""
      }`.trim()
    : "";

  const greeting = fullName
    ? `Sayın ${fullName},\n\n`
    : "";

  if (source === "student_status") {
    if (
      requestType === "deactivate" ||
      requestedStatus === "passive"
    ) {
      return (
        greeting +
        "Kayıt durumunuzla ilgili pasife alma işlemi yönetim tarafından onaylanmıştır. Kayıt durumunuz pasif olarak güncellenmiştir.\n\nSprint Yüzme Okulu"
      );
    }

    if (
      requestType === "activate" ||
      requestedStatus === "active"
    ) {
      return (
        greeting +
        "Kayıt durumunuz yönetim tarafından yeniden aktif hale getirilmiştir.\n\nSprint Yüzme Okulu"
      );
    }

    return (
      greeting +
      "Kayıt durumunuzla ilgili talebiniz yönetim tarafından onaylanmıştır.\n\nSprint Yüzme Okulu"
    );
  }

  if (
    requestType ===
    "individual_compensation"
  ) {
    return (
      greeting +
      `${lessonCount ?? 0} adet telafi dersiniz yönetim tarafından onaylanmıştır.\n\nSprint Yüzme Okulu`
    );
  }

  if (
    requestType ===
    "lesson_count_change"
  ) {
    return (
      greeting +
      `Ders paketinize ilişkin ${lessonCount ?? 0} derslik değişiklik yönetim tarafından onaylanmıştır.\n\nSprint Yüzme Okulu`
    );
  }

  if (
    requestType ===
    "bulk_compensation"
  ) {
    return (
      "Değerli kursiyerimiz,\n\n" +
      `${lessonCount ?? 0} adet telafi dersi yönetim tarafından onaylanmıştır.\n\nSprint Yüzme Okulu`
    );
  }

  return (
    greeting +
    "Talebiniz yönetim tarafından onaylanmıştır.\n\nSprint Yüzme Okulu"
  );
}

/* =========================================================
   POST
   ONAYLA / REDDET
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Oturum bulunamadı.",
        },
        {
          status: 401,
        }
      );
    }

    let body: ApprovalActionBody;

    try {
      body =
        (await request.json()) as ApprovalActionBody;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Geçersiz istek verisi.",
        },
        {
          status: 400,
        }
      );
    }

    const id =
      clean(body.id, 100);

    const source =
      clean(body.source, 50);

    const action =
      clean(body.action, 20);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Talep numarası bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      source !==
        "student_status" &&
      source !==
        "lesson_adjustment"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Geçersiz talep kaynağı.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action !== "approve" &&
      action !== "reject"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Geçersiz işlem.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       ÖĞRENCİ DURUMU
       ========================================= */

    if (
      source ===
      "student_status"
    ) {
      const {
        data:
          statusRequest,
        error:
          statusRequestError,
      } = await supabase
        .from(
          "student_status_change_requests"
        )
        .select("*")
        .eq("id", id)
        .single();

      if (
        statusRequestError ||
        !statusRequest
      ) {
        console.error(
          "status request lookup error:",
          statusRequestError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Öğrenci durum talebi bulunamadı.",
            details:
              statusRequestError?.message,
          },
          {
            status: 404,
          }
        );
      }

      if (
        statusRequest.status !==
        "pending"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Bu talep daha önce işlenmiş.",
          },
          {
            status: 409,
          }
        );
      }

      /*
       * REDDET
       */

      if (
        action === "reject"
      ) {
        const {
          error:
            rejectError,
        } = await supabase
          .from(
            "student_status_change_requests"
          )
          .update({
            status:
              "rejected",
          })
          .eq("id", id)
          .eq(
            "status",
            "pending"
          );

        if (rejectError) {
          console.error(
            "status reject error:",
            rejectError
          );

          return NextResponse.json(
            {
              ok: false,
              error:
                "Talep reddedilemedi.",
              details:
                rejectError.message,
            },
            {
              status: 500,
            }
          );
        }

        return NextResponse.json({
          ok: true,
          action:
            "rejected",
          source,
          id,
          message:
            "Öğrenci durum talebi reddedildi.",
        });
      }

      /*
       * ONAYLA
       */

      const studentId =
        clean(
          statusRequest.student_id,
          100
        );

      if (!studentId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Talebe ait öğrenci bulunamadı.",
          },
          {
            status: 400,
          }
        );
      }

      const targetStatus =
        clean(
          statusRequest.requested_status ??
            statusRequest.new_status,
          30
        ) ||
        (statusRequest.request_type ===
        "deactivate"
          ? "passive"
          : statusRequest.request_type ===
            "activate"
          ? "active"
          : "");

      if (
        targetStatus !==
          "active" &&
        targetStatus !==
          "passive"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Talep edilen öğrenci durumu geçersiz.",
          },
          {
            status: 400,
          }
        );
      }

      const {
        error:
          studentUpdateError,
      } = await supabase
        .from("students")
        .update({
          status:
            targetStatus,
        })
        .eq(
          "id",
          studentId
        );

      if (
        studentUpdateError
      ) {
        console.error(
          "student status update error:",
          studentUpdateError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Öğrencinin durumu güncellenemedi.",
            details:
              studentUpdateError.message,
          },
          {
            status: 500,
          }
        );
      }

      const {
        error:
          requestUpdateError,
      } = await supabase
        .from(
          "student_status_change_requests"
        )
        .update({
          status:
            "approved",
        })
        .eq("id", id)
        .eq(
          "status",
          "pending"
        );

      if (
        requestUpdateError
      ) {
        console.error(
          "status request approve error:",
          requestUpdateError
        );

        /*
         * Öğrenci durumu değişti ancak
         * talep approved yapılamadı.
         * Bu nedenle açık hata dönüyoruz.
         */

        return NextResponse.json(
          {
            ok: false,
            error:
              "Öğrenci durumu değiştirildi ancak talep kaydı tamamlanamadı.",
            details:
              requestUpdateError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
        action:
          "approved",
        source,
        id,
        student_id:
          studentId,
        new_status:
          targetStatus,
        message:
          targetStatus ===
          "passive"
            ? "Öğrenci pasife alındı."
            : "Öğrenci aktif hale getirildi.",
      });
    }

    /* =========================================
       DERS / TELAFİ İŞLEMLERİ
       ========================================= */

    const {
      data:
        lessonRequest,
      error:
        lessonRequestError,
    } = await supabase
      .from(
        "lesson_adjustment_requests"
      )
      .select("*")
      .eq("id", id)
      .single();

    if (
      lessonRequestError ||
      !lessonRequest
    ) {
      console.error(
        "lesson request lookup error:",
        lessonRequestError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Ders işlem talebi bulunamadı.",
          details:
            lessonRequestError?.message,
        },
        {
          status: 404,
        }
      );
    }

    if (
      lessonRequest.status !==
      "pending"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu talep daha önce işlenmiş.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * DERS TALEBİNİ REDDET
     */

    if (
      action === "reject"
    ) {
      const {
        error:
          lessonRejectError,
      } = await supabase
        .from(
          "lesson_adjustment_requests"
        )
        .update({
          status:
            "rejected",
        })
        .eq("id", id)
        .eq(
          "status",
          "pending"
        );

      if (
        lessonRejectError
      ) {
        console.error(
          "lesson reject error:",
          lessonRejectError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Ders işlemi reddedilemedi.",
            details:
              lessonRejectError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ok: true,
        action:
          "rejected",
        source,
        id,
        message:
          "Ders işlem talebi reddedildi.",
      });
    }

    /*
     * DERS TALEBİNİ ONAYLA
     *
     * Burada yalnızca talebi onaylıyoruz.
     * Öğrencinin gerçek kalan ders /
     * telafi bakiyesinin tutulduğu tablo
     * ve kolon henüz doğrulanmadığı için
     * bilinmeyen kolona veri yazmıyoruz.
     */

    const {
      error:
        lessonApproveError,
    } = await supabase
      .from(
        "lesson_adjustment_requests"
      )
      .update({
        status:
          "approved",
      })
      .eq("id", id)
      .eq(
        "status",
        "pending"
      );

    if (
      lessonApproveError
    ) {
      console.error(
        "lesson approve error:",
        lessonApproveError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Ders işlem talebi onaylanamadı.",
          details:
            lessonApproveError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      action:
        "approved",
      source,
      id,
      request_type:
        lessonRequest.request_type ??
        null,
      lesson_count:
        lessonRequest.lesson_count ??
        null,
      student_id:
        lessonRequest.student_id ??
        null,
      message:
        "Ders işlem talebi onaylandı.",
    });
  } catch (error) {
    console.error(
      "approval-center POST error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Onay işlemi sırasında beklenmeyen bir hata oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   GET
   BEKLEYEN ONAYLARI GETİR
   ========================================================= */

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Oturum bulunamadı.",
        },
        {
          status: 401,
        }
      );
    }

    const [
      statusRequestResult,
      lessonRequestResult,
    ] = await Promise.all([
      supabase
        .from(
          "student_status_change_requests"
        )
        .select("*")
        .eq(
          "status",
          "pending"
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),

      supabase
        .from(
          "lesson_adjustment_requests"
        )
        .select("*")
        .eq(
          "status",
          "pending"
        )
        .order(
          "requested_at",
          {
            ascending:
              false,
          }
        ),
    ]);

    if (
      statusRequestResult.error
    ) {
      console.error(
        "student status approval list error:",
        statusRequestResult.error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Öğrenci durum talepleri alınamadı.",
          details:
            statusRequestResult
              .error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      lessonRequestResult.error
    ) {
      console.error(
        "lesson approval list error:",
        lessonRequestResult.error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Ders işlem talepleri alınamadı.",
          details:
            lessonRequestResult
              .error.message,
        },
        {
          status: 500,
        }
      );
    }

    const statusRequests =
      statusRequestResult.data ??
      [];

    const lessonRequests =
      lessonRequestResult.data ??
      [];

    const studentIds =
      Array.from(
        new Set(
          [
            ...statusRequests.map(
              (item) =>
                item.student_id
            ),

            ...lessonRequests.map(
              (item) =>
                item.student_id
            ),
          ].filter(
            (
              id
            ): id is string =>
              typeof id ===
                "string" &&
              id.trim().length >
                0
          )
        )
      );

    let students:
      StudentInfo[] = [];

    if (
      studentIds.length >
      0
    ) {
      const {
        data:
          studentData,
        error:
          studentError,
      } = await supabase
        .from("students")
        .select(
          `
            id,
            first_name,
            last_name,
            phone,
            guardian_name,
            guardian_phone,
            emergency_contact_phone,
            branch_id
          `
        )
        .in(
          "id",
          studentIds
        );

      if (studentError) {
        console.error(
          "approval center students error:",
          studentError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              "Onay taleplerine ait öğrenci bilgileri alınamadı.",
            details:
              studentError.message,
          },
          {
            status: 500,
          }
        );
      }

      students =
        (studentData ??
          []) as StudentInfo[];
    }

    const studentMap =
      new Map<
        string,
        StudentInfo
      >(
        students.map(
          (student) => [
            student.id,
            student,
          ]
        )
      );

    const statusItems:
      UnifiedApprovalRequest[] =
      statusRequests.map(
        (item) => {
          const student =
            item.student_id
              ? studentMap.get(
                  item.student_id
                ) ?? null
              : null;

          const recipient =
            getRecipient(
              student
            );

          const requestedStatus =
            item.requested_status ??
            item.new_status ??
            null;

          return {
            id: item.id,

            source:
              "student_status",

            category:
              "student",

            request_type:
              item.request_type ??
              "status_change",

            request_label:
              requestLabel(
                "student_status",
                item.request_type ??
                  "status_change",
                requestedStatus
              ),

            student_id:
              item.student_id ??
              null,

            branch_id:
              item.branch_id ??
              null,

            group_id:
              item.group_id ??
              null,

            lesson_count:
              null,

            reason:
              item.reason ??
              null,

            description:
              item.description ??
              null,

            old_status:
              item.old_status ??
              null,

            new_status:
              item.new_status ??
              null,

            requested_status:
              requestedStatus,

            status:
              item.status ??
              "pending",

            requested_by:
              item.requested_by ??
              null,

            requested_at:
              item.requested_at ??
              null,

            created_at:
              item.created_at ??
              null,

            student,

            recipient_phone:
              recipient.phone,

            recipient_type:
              recipient.type,

            suggested_message:
              buildSuggestedMessage({
                student,

                requestType:
                  item.request_type ??
                  "status_change",

                source:
                  "student_status",

                lessonCount:
                  null,

                requestedStatus,
              }),
          };
        }
      );

    const lessonItems:
      UnifiedApprovalRequest[] =
      lessonRequests.map(
        (item) => {
          const student =
            item.student_id
              ? studentMap.get(
                  item.student_id
                ) ?? null
              : null;

          const recipient =
            getRecipient(
              student
            );

          return {
            id: item.id,

            source:
              "lesson_adjustment",

            category:
              "lesson",

            request_type:
              item.request_type ??
              "lesson_adjustment",

            request_label:
              requestLabel(
                "lesson_adjustment",
                item.request_type ??
                  "lesson_adjustment"
              ),

            student_id:
              item.student_id ??
              null,

            branch_id:
              item.branch_id ??
              null,

            group_id:
              item.group_id ??
              null,

            lesson_count:
              item.lesson_count ??
              null,

            reason:
              item.reason ??
              null,

            description:
              item.description ??
              null,

            old_status:
              null,

            new_status:
              null,

            requested_status:
              null,

            status:
              item.status ??
              "pending",

            requested_by:
              item.requested_by ??
              null,

            requested_at:
              item.requested_at ??
              null,

            created_at:
              item.created_at ??
              null,

            student,

            recipient_phone:
              recipient.phone,

            recipient_type:
              recipient.type,

            suggested_message:
              buildSuggestedMessage({
                student,

                requestType:
                  item.request_type ??
                  "lesson_adjustment",

                source:
                  "lesson_adjustment",

                lessonCount:
                  item.lesson_count ??
                  null,

                requestedStatus:
                  null,
              }),
          };
        }
      );

    const requests = [
      ...statusItems,
      ...lessonItems,
    ].sort(
      (a, b) => {
        const aDate =
          a.requested_at ??
          a.created_at ??
          "";

        const bDate =
          b.requested_at ??
          b.created_at ??
          "";

        const aTime =
          aDate
            ? new Date(
                aDate
              ).getTime()
            : 0;

        const bTime =
          bDate
            ? new Date(
                bDate
              ).getTime()
            : 0;

        return (
          bTime - aTime
        );
      }
    );

    return NextResponse.json({
      ok: true,

      counts: {
        total:
          requests.length,

        student:
          statusItems.length,

        lesson:
          lessonItems.length,
      },

      students_found:
        students.length,

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
      {
        status: 500,
      }
    );
  }
}
