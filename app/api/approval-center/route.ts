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

export async function POST(request: NextRequest) {
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

    let body: ApprovalActionBody;

    try {
      body = (await request.json()) as ApprovalActionBody;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz istek verisi.",
        },
        { status: 400 }
      );
    }

    const id = clean(body.id, 100);
    const source = clean(body.source, 50);
    const action = clean(body.action, 20);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Talep numarası bulunamadı.",
        },
        { status: 400 }
      );
    }

    if (
      source !== "student_status" &&
      source !== "lesson_adjustment"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz talep kaynağı.",
        },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz işlem.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       ONAYLAYAN PERSONEL
       ===================================================== */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id, organization_id, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "approval profile lookup error:",
        profileError
      );
    }

    const actorId = profile?.id ?? user.id;
    const actorName = profile?.full_name ?? user.email ?? "Yönetici";

    /* =====================================================
       ÖĞRENCİ DURUM TALEBİ
       ===================================================== */

    if (source === "student_status") {
      const {
        data: statusRequest,
        error: statusRequestError,
      } = await supabase
        .from("student_status_change_requests")
        .select("*")
        .eq("id", id)
        .single();

      if (statusRequestError || !statusRequest) {
        return NextResponse.json(
          {
            ok: false,
            error: "Öğrenci durum talebi bulunamadı.",
            details: statusRequestError?.message,
          },
          { status: 404 }
        );
      }

      if (statusRequest.status !== "pending") {
        return NextResponse.json(
          {
            ok: false,
            error: "Bu talep daha önce işlenmiş.",
          },
          { status: 409 }
        );
      }

      const organizationId =
        statusRequest.organization_id ??
        profile?.organization_id ??
        null;

      const studentId =
        typeof statusRequest.student_id === "string"
          ? statusRequest.student_id
          : null;

      if (!organizationId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Kurum bilgisi bulunamadı.",
          },
          { status: 400 }
        );
      }

      /* ---------------- REDDET ---------------- */

      if (action === "reject") {
        const { error: rejectError } = await supabase
          .from("student_status_change_requests")
          .update({
            status: "rejected",
          })
          .eq("id", id)
          .eq("status", "pending");

        if (rejectError) {
          return NextResponse.json(
            {
              ok: false,
              error: "Talep reddedilemedi.",
              details: rejectError.message,
            },
            { status: 500 }
          );
        }

        const { error: historyError } = await supabase
          .from("approval_history")
          .insert({
            organization_id: organizationId,
            student_id: studentId,
            source_type: "student_status",
            source_id: id,
            action_type:
              statusRequest.request_type ?? "status_change",
            decision: "rejected",
            reason: statusRequest.reason ?? null,
            requested_by: statusRequest.requested_by ?? null,
            requested_at:
              statusRequest.requested_at ??
              statusRequest.created_at ??
              null,
            decided_by: actorId,
            decided_at: new Date().toISOString(),
            snapshot: statusRequest,
          });

        if (historyError) {
          console.error(
            "approval reject history error:",
            historyError
          );
        }

        if (studentId) {
          const { error: activityError } = await supabase
            .from("student_activity_logs")
            .insert({
              organization_id: organizationId,
              student_id: studentId,
              activity_type: "approval_rejected",
              title: "Öğrenci durum talebi reddedildi",
              description:
                statusRequest.reason ??
                "Öğrenci durum değişikliği reddedildi.",
              source_type: "student_status",
              source_id: id,
              performed_by: actorId,
              performed_at: new Date().toISOString(),
            });

          if (activityError) {
            console.error(
              "student activity reject error:",
              activityError
            );
          }
        }

        return NextResponse.json({
          ok: true,
          action: "rejected",
          source,
          id,
          message: "Öğrenci durum talebi reddedildi.",
        });
      }

      /* ---------------- ONAYLA ---------------- */

      if (!studentId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Talebe ait öğrenci bulunamadı.",
          },
          { status: 400 }
        );
      }

      const targetStatus =
        clean(
          statusRequest.requested_status ??
            statusRequest.new_status,
          30
        ) ||
        (statusRequest.request_type === "deactivate"
          ? "passive"
          : statusRequest.request_type === "activate"
          ? "active"
          : "");

      if (
        targetStatus !== "active" &&
        targetStatus !== "passive"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Talep edilen öğrenci durumu geçersiz.",
          },
          { status: 400 }
        );
      }

      const {
        data: studentBefore,
        error: studentLookupError,
      } = await supabase
        .from("students")
        .select("id, first_name, last_name, status")
        .eq("id", studentId)
        .single();

      if (studentLookupError || !studentBefore) {
        return NextResponse.json(
          {
            ok: false,
            error: "Öğrenci bulunamadı.",
            details: studentLookupError?.message,
          },
          { status: 404 }
        );
      }

      const { error: studentUpdateError } = await supabase
        .from("students")
        .update({
          status: targetStatus,
        })
        .eq("id", studentId);

      if (studentUpdateError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Öğrencinin durumu güncellenemedi.",
            details: studentUpdateError.message,
          },
          { status: 500 }
        );
      }

      const { error: requestUpdateError } = await supabase
        .from("student_status_change_requests")
        .update({
          status: "approved",
        })
        .eq("id", id)
        .eq("status", "pending");

      if (requestUpdateError) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Öğrenci durumu değiştirildi ancak talep kaydı tamamlanamadı.",
            details: requestUpdateError.message,
          },
          { status: 500 }
        );
      }

      const { error: approvalHistoryError } = await supabase
        .from("approval_history")
        .insert({
          organization_id: organizationId,
          student_id: studentId,
          source_type: "student_status",
          source_id: id,
          action_type:
            statusRequest.request_type ?? "status_change",
          decision: "approved",
          reason: statusRequest.reason ?? null,
          requested_by: statusRequest.requested_by ?? null,
          requested_at:
            statusRequest.requested_at ??
            statusRequest.created_at ??
            null,
          decided_by: actorId,
          decided_at: new Date().toISOString(),
          snapshot: {
            ...statusRequest,
            approved_status: targetStatus,
            approved_by_name: actorName,
          },
        });

      if (approvalHistoryError) {
        console.error(
          "status approval history error:",
          approvalHistoryError
        );
      }

      const { error: activityError } = await supabase
        .from("student_activity_logs")
        .insert({
          organization_id: organizationId,
          student_id: studentId,
          activity_type: "status_change",
          title:
            targetStatus === "passive"
              ? "Öğrenci pasife alındı"
              : "Öğrenci aktif hale getirildi",
          description:
            statusRequest.reason ??
            "Yönetici onayı ile öğrenci durumu değiştirildi.",
          old_value: {
            status:
              statusRequest.old_status ??
              studentBefore.status ??
              null,
          },
          new_value: {
            status: targetStatus,
          },
          source_type: "student_status",
          source_id: id,
          performed_by: actorId,
          approved_by: actorId,
          performed_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
        });

      if (activityError) {
        console.error(
          "status student activity error:",
          activityError
        );
      }

      const { error: notificationError } = await supabase
        .from("system_notifications")
        .insert({
          organization_id: organizationId,
          recipient_profile_id: null,
          notification_type: "student_status_approved",
          title:
            targetStatus === "passive"
              ? "Öğrenci pasife alındı"
              : "Öğrenci aktif hale getirildi",
          body: `${studentBefore.first_name ?? ""} ${
            studentBefore.last_name ?? ""
          } öğrencisinin durum değişikliği ${actorName} tarafından onaylandı.`,
          priority: "normal",
          student_id: studentId,
          source_type: "student_status",
          source_id: id,
          target_path: `/ogrenciler/${studentId}`,
          push_required: true,
        });

      if (notificationError) {
        console.error(
          "status notification error:",
          notificationError
        );
      }

      return NextResponse.json({
        ok: true,
        action: "approved",
        source,
        id,
        student_id: studentId,
        new_status: targetStatus,
        approved_by: actorName,
        message:
          targetStatus === "passive"
            ? "Öğrenci pasife alındı."
            : "Öğrenci aktif hale getirildi.",
      });
    }

    /* =====================================================
       DERS / TELAFİ TALEBİ
       ===================================================== */

    const {
      data: lessonRequest,
      error: lessonRequestError,
    } = await supabase
      .from("lesson_adjustment_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (lessonRequestError || !lessonRequest) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ders işlem talebi bulunamadı.",
          details: lessonRequestError?.message,
        },
        { status: 404 }
      );
    }

    if (lessonRequest.status !== "pending") {
      return NextResponse.json(
        {
          ok: false,
          error: "Bu talep daha önce işlenmiş.",
        },
        { status: 409 }
      );
    }

    const organizationId =
      lessonRequest.organization_id ??
      profile?.organization_id ??
      null;

    if (!organizationId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kurum bilgisi bulunamadı.",
        },
        { status: 400 }
      );
    }

    const lessonCount = Number(lessonRequest.lesson_count ?? 0);

    if (
      !Number.isInteger(lessonCount) ||
      lessonCount <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz ders sayısı.",
        },
        { status: 400 }
      );
    }

    const requestType =
      lessonRequest.request_type ?? "lesson_adjustment";

    /* ---------------- REDDET ---------------- */

    if (action === "reject") {
      const { error: lessonRejectError } = await supabase
        .from("lesson_adjustment_requests")
        .update({
          status: "rejected",
        })
        .eq("id", id)
        .eq("status", "pending");

      if (lessonRejectError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Ders işlemi reddedilemedi.",
            details: lessonRejectError.message,
          },
          { status: 500 }
        );
      }

      const { error: historyError } = await supabase
        .from("approval_history")
        .insert({
          organization_id: organizationId,
          student_id: lessonRequest.student_id ?? null,
          source_type: "lesson_adjustment",
          source_id: id,
          action_type: requestType,
          decision: "rejected",
          reason: lessonRequest.reason ?? null,
          requested_by: lessonRequest.requested_by ?? null,
          requested_at:
            lessonRequest.requested_at ??
            lessonRequest.created_at ??
            null,
          decided_by: actorId,
          decided_at: new Date().toISOString(),
          snapshot: lessonRequest,
        });

      if (historyError) {
        console.error(
          "lesson reject history error:",
          historyError
        );
      }

      return NextResponse.json({
        ok: true,
        action: "rejected",
        source,
        id,
        message: "Ders işlem talebi reddedildi.",
      });
    }

    /* =====================================================
       BİREYSEL TELAFİ
       ===================================================== */

    if (requestType === "individual_compensation") {
      const studentId = lessonRequest.student_id;

      if (!studentId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Telafi öğrencisi bulunamadı.",
          },
          { status: 400 }
        );
      }

      const { error: ledgerError } = await supabase
        .from("student_lesson_ledger")
        .insert({
          organization_id: organizationId,
          student_id: studentId,
          group_id: lessonRequest.group_id ?? null,
          lesson_type: "compensation",
          direction: "credit",
          lesson_count: lessonCount,
          reason: lessonRequest.reason ?? null,
          description: lessonRequest.description ?? null,
          source_type: "individual_compensation",
          source_id: id,
          requires_approval: true,
          approval_status: "approved",
          requested_by: lessonRequest.requested_by ?? null,
          requested_at:
            lessonRequest.requested_at ??
            lessonRequest.created_at ??
            new Date().toISOString(),
          approved_by: actorId,
          approved_at: new Date().toISOString(),
        });

      if (ledgerError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Telafi öğrenci hesabına eklenemedi.",
            details: ledgerError.message,
          },
          { status: 500 }
        );
      }

      const { error: requestApproveError } = await supabase
        .from("lesson_adjustment_requests")
        .update({
          status: "approved",
        })
        .eq("id", id)
        .eq("status", "pending");

      if (requestApproveError) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Telafi eklendi ancak talep kaydı tamamlanamadı.",
            details: requestApproveError.message,
          },
          { status: 500 }
        );
      }

      await Promise.all([
        supabase.from("approval_history").insert({
          organization_id: organizationId,
          student_id: studentId,
          source_type: "lesson_adjustment",
          source_id: id,
          action_type: requestType,
          decision: "approved",
          reason: lessonRequest.reason ?? null,
          requested_by: lessonRequest.requested_by ?? null,
          requested_at:
            lessonRequest.requested_at ??
            lessonRequest.created_at ??
            null,
          decided_by: actorId,
          decided_at: new Date().toISOString(),
          snapshot: lessonRequest,
        }),

        supabase.from("student_activity_logs").insert({
          organization_id: organizationId,
          student_id: studentId,
          activity_type: "compensation_added",
          title: `${lessonCount} telafi dersi eklendi`,
          description:
            lessonRequest.reason ??
            "Yönetici onayı ile telafi dersi eklendi.",
          new_value: {
            compensation_lessons_added: lessonCount,
          },
          source_type: "lesson_adjustment",
          source_id: id,
          performed_by: actorId,
          approved_by: actorId,
          performed_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
        }),

        supabase.from("system_notifications").insert({
          organization_id: organizationId,
          recipient_profile_id: null,
          notification_type: "compensation_approved",
          title: "Telafi dersi onaylandı",
          body: `${lessonCount} adet telafi dersi ${actorName} tarafından onaylandı.`,
          priority: "normal",
          student_id: studentId,
          source_type: "lesson_adjustment",
          source_id: id,
          target_path: `/ogrenciler/${studentId}`,
          push_required: true,
        }),

        supabase.from("student_contact_logs").insert({
          organization_id: organizationId,
          student_id: studentId,
          contact_type: "compensation",
          channel: "whatsapp",
          status: "prepared",
          message_text:
            `${lessonCount} adet telafi dersiniz ` +
            `${lessonRequest.reason ?? "ilgili işlem"} nedeniyle ` +
            "yönetim tarafından onaylanmış ve hesabınıza tanımlanmıştır.\n\n" +
            "Keyifli dersler dileriz.\nSprint Yüzme Okulu",
          prepared_at: new Date().toISOString(),
        }),
      ]);

      return NextResponse.json({
        ok: true,
        action: "approved",
        source,
        id,
        request_type: requestType,
        lesson_count: lessonCount,
        student_id: studentId,
        approved_by: actorName,
        message: `${lessonCount} telafi dersi öğrenci hesabına eklendi.`,
      });
    }

    /* =====================================================
       TOPLU TELAFİ
       ===================================================== */

    if (requestType === "bulk_compensation") {
      const groupId = lessonRequest.group_id;

      if (!groupId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Toplu telafi için grup seçilmemiş.",
          },
          { status: 400 }
        );
      }

      const {
        data: memberships,
        error: membershipsError,
      } = await supabase
        .from("student_group_memberships")
        .select("student_id")
        .eq("group_id", groupId);

      if (membershipsError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Grup öğrencileri alınamadı.",
            details: membershipsError.message,
          },
          { status: 500 }
        );
      }

      const studentIds = [
        ...new Set(
          (memberships ?? [])
            .map((item) => item.student_id)
            .filter(
              (studentId): studentId is string =>
                typeof studentId === "string"
            )
        ),
      ];

      if (studentIds.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Seçilen grupta öğrenci bulunamadı.",
          },
          { status: 400 }
        );
      }

      const ledgerRows = studentIds.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        group_id: groupId,
        lesson_type: "compensation",
        direction: "credit",
        lesson_count: lessonCount,
        reason: lessonRequest.reason ?? null,
        description: lessonRequest.description ?? null,
        source_type: "bulk_compensation",
        source_id: id,
        requires_approval: true,
        approval_status: "approved",
        requested_by: lessonRequest.requested_by ?? null,
        requested_at:
          lessonRequest.requested_at ??
          lessonRequest.created_at ??
          new Date().toISOString(),
        approved_by: actorId,
        approved_at: new Date().toISOString(),
      }));

      const { error: bulkLedgerError } = await supabase
        .from("student_lesson_ledger")
        .insert(ledgerRows);

      if (bulkLedgerError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Toplu telafi öğrencilere eklenemedi.",
            details: bulkLedgerError.message,
          },
          { status: 500 }
        );
      }

      const activityRows = studentIds.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        activity_type: "bulk_compensation_added",
        title: `${lessonCount} toplu telafi dersi eklendi`,
        description:
          lessonRequest.reason ??
          "Grup için yönetici onaylı toplu telafi eklendi.",
        new_value: {
          compensation_lessons_added: lessonCount,
          group_id: groupId,
        },
        source_type: "lesson_adjustment",
        source_id: id,
        performed_by: actorId,
        approved_by: actorId,
        performed_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      }));

      const contactRows = studentIds.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        contact_type: "compensation",
        channel: "whatsapp",
        status: "prepared",
        message_text:
          `Değerli kursiyerimiz,\n\n` +
          `${lessonRequest.reason ?? "Havuz kaynaklı program değişikliği"} nedeniyle ` +
          `${lessonCount} adet telafi dersiniz yönetim tarafından onaylanmış ve hesabınıza tanımlanmıştır.\n\n` +
          `Keyifli dersler dileriz.\nSprint Yüzme Okulu`,
        prepared_at: new Date().toISOString(),
      }));

      const notificationRows = studentIds.map((studentId) => ({
        organization_id: organizationId,
        recipient_profile_id: null,
        notification_type: "bulk_compensation_approved",
        title: "Toplu telafi dersi eklendi",
        body:
          `${lessonCount} telafi dersi grup öğrencisine tanımlandı. ` +
          `Onaylayan: ${actorName}`,
        priority: "normal",
        student_id: studentId,
        source_type: "lesson_adjustment",
        source_id: id,
        target_path: `/ogrenciler/${studentId}`,
        push_required: true,
      }));

      await Promise.all([
        supabase
          .from("student_activity_logs")
          .insert(activityRows),

        supabase
          .from("student_contact_logs")
          .insert(contactRows),

        supabase
          .from("system_notifications")
          .insert(notificationRows),

        supabase
          .from("approval_history")
          .insert({
            organization_id: organizationId,
            student_id: null,
            source_type: "lesson_adjustment",
            source_id: id,
            action_type: "bulk_compensation",
            decision: "approved",
            reason: lessonRequest.reason ?? null,
            requested_by: lessonRequest.requested_by ?? null,
            requested_at:
              lessonRequest.requested_at ??
              lessonRequest.created_at ??
              null,
            decided_by: actorId,
            decided_at: new Date().toISOString(),
            snapshot: {
              ...lessonRequest,
              affected_students: studentIds,
              affected_student_count: studentIds.length,
            },
          }),
      ]);

      const { error: bulkApproveError } = await supabase
        .from("lesson_adjustment_requests")
        .update({
          status: "approved",
        })
        .eq("id", id)
        .eq("status", "pending");

      if (bulkApproveError) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Telafiler eklendi ancak talep kaydı tamamlanamadı.",
            details: bulkApproveError.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        action: "approved",
        source,
        id,
        request_type: requestType,
        lesson_count: lessonCount,
        group_id: groupId,
        affected_students: studentIds.length,
        approved_by: actorName,
        message:
          `${studentIds.length} öğrenciye ${lessonCount} adet telafi dersi eklendi.`,
      });
    }

    /* =====================================================
       DERS SAYISI DEĞİŞİKLİĞİ

       ŞİMDİLİK BAKİYEYE YAZMIYORUZ.
       Çünkü mevcut istekte:
       - artış mı?
       - düşüş mü?
       - yeni paket toplamı mı?
       bilgisi bulunmuyor.

       Yanlış ders bakiyesi oluşturmamak için yalnız onay geçmişine
       kaydediyoruz. Bir sonraki aşamada direction / target_count ekleyeceğiz.
       ===================================================== */

    if (requestType === "lesson_count_change") {
      const studentId = lessonRequest.student_id;

      if (!studentId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Öğrenci bulunamadı.",
          },
          { status: 400 }
        );
      }

      const { error: requestApproveError } = await supabase
        .from("lesson_adjustment_requests")
        .update({
          status: "approved",
        })
        .eq("id", id)
        .eq("status", "pending");

      if (requestApproveError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Ders sayısı talebi onaylanamadı.",
            details: requestApproveError.message,
          },
          { status: 500 }
        );
      }

      await Promise.all([
        supabase.from("approval_history").insert({
          organization_id: organizationId,
          student_id: studentId,
          source_type: "lesson_adjustment",
          source_id: id,
          action_type: "lesson_count_change",
          decision: "approved",
          reason: lessonRequest.reason ?? null,
          requested_by: lessonRequest.requested_by ?? null,
          requested_at:
            lessonRequest.requested_at ??
            lessonRequest.created_at ??
            null,
          decided_by: actorId,
          decided_at: new Date().toISOString(),
          snapshot: lessonRequest,
        }),

        supabase.from("student_activity_logs").insert({
          organization_id: organizationId,
          student_id: studentId,
          activity_type: "lesson_count_change_approved",
          title: "Ders sayısı değişikliği onaylandı",
          description:
            `${lessonCount} derslik değişiklik talebi onaylandı. ` +
            "Bakiyeye uygulanması yeni ders yönü modeli tamamlandıktan sonra yapılacaktır.",
          source_type: "lesson_adjustment",
          source_id: id,
          performed_by: actorId,
          approved_by: actorId,
          performed_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
        }),
      ]);

      return NextResponse.json({
        ok: true,
        action: "approved",
        source,
        id,
        request_type: requestType,
        lesson_count: lessonCount,
        student_id: studentId,
        approved_by: actorName,
        message: "Ders sayısı değişikliği onaylandı.",
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Desteklenmeyen ders işlem türü: ${requestType}`,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "approval-center POST error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Onay işlemi sırasında beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
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
