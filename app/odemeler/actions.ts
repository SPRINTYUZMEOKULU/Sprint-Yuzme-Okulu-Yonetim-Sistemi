"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

type PaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "eft"
  | "other";

type CreatePaymentInput = {
  studentId: string;
  enrollmentId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description?: string | null;
  dueDate?: string | null;
};

type PaymentActionResult = {
  ok: boolean;
  paymentId?: string;
  approvalRequestId?: string;
  message: string;
};

type ApprovalRuleState = {
  is_active: boolean;
  requires_approval: boolean;
  dashboard_notification: boolean;
  push_notification: boolean;
};

type PaymentEditChanges = {
  amount?: number;
  paymentMethod?: PaymentMethod;
  description?: string | null;
};

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
] as const;

const ALLOWED_METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "bank_transfer",
  "eft",
  "other",
];

async function getAuthorizedProfile() {
  return requireProfile([...ALLOWED_ROLES]);
}

function cleanDescription(value?: string | null) {
  const text = String(value || "").trim();

  return text.length ? text.slice(0, 1000) : null;
}

function cleanReason(value?: string | null) {
  const text = String(value || "").trim();

  return text.length ? text.slice(0, 1000) : null;
}

function normalizeAmount(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

function paymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case "cash":
      return "nakit";
    case "card":
      return "kart";
    case "bank_transfer":
      return "banka havalesi";
    case "eft":
      return "EFT";
    default:
      return "diğer";
  }
}

function revalidateFinancePaths(studentId?: string | null) {
  revalidatePath("/odemeler");
  revalidatePath("/ogrenciler");

  if (studentId) {
    revalidatePath(`/ogrenciler/${studentId}`);
  }

  revalidatePath("/kasa");
  revalidatePath("/veli-odemeler");
  revalidatePath("/onay-merkezi");
  revalidatePath("/ayarlar/onay-merkezi");
  revalidatePath("/");
}

async function getApprovalRule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  ruleKey: string
): Promise<ApprovalRuleState> {
  const { data, error } = await supabase
    .from("approval_rules")
    .select(
      "is_active,requires_approval,dashboard_notification,push_notification"
    )
    .eq("organization_id", organizationId)
    .eq("rule_key", ruleKey)
    .maybeSingle();

  if (error) {
    console.error(`approval rule read error (${ruleKey}):`, error);
  }

  /*
   * Güvenli varsayılan:
   * Kural bulunamazsa kritik işlem doğrudan uygulanmaz.
   */
  return {
    is_active: data?.is_active ?? true,
    requires_approval: data?.requires_approval ?? true,
    dashboard_notification: data?.dashboard_notification ?? true,
    push_notification: data?.push_notification ?? false,
  };
}

async function addSystemNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    organizationId: string;
    createdBy?: string | null;
    category: string;
    eventKey: string;
    title: string;
    message: string;
    severity?: "info" | "success" | "warning" | "error";
    entityType?: string | null;
    entityId?: string | null;
    pushRequested?: boolean;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("system_notifications").insert({
    organization_id: input.organizationId,
    recipient_user_id: null,
    category: input.category,
    event_key: input.eventKey,
    title: input.title,
    message: input.message,
    severity: input.severity || "info",
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    is_read: false,
    push_requested: Boolean(input.pushRequested),
    metadata: input.metadata || {},
    created_by: input.createdBy || null,
  });

  /*
   * Bildirim yazılamaması ödeme/tahsilat gibi ana işlemi bozmasın.
   * Hata loglanır; ana işlem devam eder.
   */
  if (error) {
    console.error("system notification insert error:", error);
  }
}

async function createApprovalRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    organizationId: string;
    requestType: string;
    module: string;
    entityType: string;
    entityId: string;
    studentId?: string | null;
    requestedBy: string;
    reason: string;
    oldValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
  }
) {
  /*
   * Aynı kayıt için aynı tipte ikinci bekleyen talebi engelle.
   */
  const { data: existing } = await supabase
    .from("approval_requests")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("request_type", input.requestType)
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.id) {
    return {
      id: existing.id as string,
      alreadyExists: true,
    };
  }

  const { data, error } = await supabase
    .from("approval_requests")
    .insert({
      organization_id: input.organizationId,
      request_type: input.requestType,
      module: input.module,
      entity_type: input.entityType,
      entity_id: input.entityId,
      student_id: input.studentId || null,
      requested_by: input.requestedBy,
      requested_by_name: null,
      reason: input.reason,
      old_values: input.oldValues,
      new_values: input.newValues,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "Onay talebi oluşturulamadı."
    );
  }

  return {
    id: data.id as string,
    alreadyExists: false,
  };
}

/*
 * ----------------------------------------------------
 * YENİ ÖDEME AL
 * ----------------------------------------------------
 *
 * Bütün ödeme girişleri student_payments tablosuna gider.
 * Böylece Ödeme Merkezi, Öğrenci Merkezi, Öğrenci Dosyası,
 * Günlük Kasa ve Veli Ödemeleri aynı hareketi okuyabilir.
 */
export async function createStudentPayment(
  input: CreatePaymentInput
): Promise<PaymentActionResult> {
  try {
    const profile = await getAuthorizedProfile();
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    const studentId = String(input.studentId || "").trim();
    const enrollmentId = String(input.enrollmentId || "").trim();

    if (!studentId || !enrollmentId) {
      return {
        ok: false,
        message: "Öğrenci ve aktif kayıt bilgisi zorunludur.",
      };
    }

    const amount = normalizeAmount(input.amount);

    if (amount === null) {
      return {
        ok: false,
        message: "Geçerli bir ödeme tutarı giriniz.",
      };
    }

    if (!ALLOWED_METHODS.includes(input.paymentMethod)) {
      return {
        ok: false,
        message: "Geçersiz ödeme yöntemi.",
      };
    }

    const supabase = await createClient();

    /*
     * ÖĞRENCİ DOĞRULAMA
     */
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, organization_id, first_name, last_name")
      .eq("id", studentId)
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (studentError || !student) {
      return {
        ok: false,
        message: "Öğrenci bulunamadı veya bu kuruma ait değil.",
      };
    }

    /*
     * AKTİF KAYIT DOĞRULAMA
     *
     * Her ödeme enrollment'a bağlıdır.
     * Eski paket ödemesi yeni kayıt dönemine karışmaz.
     */
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .select(
        "id,student_id,organization_id,status,start_date,payment_due_date"
      )
      .eq("id", enrollmentId)
      .eq("student_id", studentId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      return {
        ok: false,
        message: "Öğrencinin kayıt/paket dönemi bulunamadı.",
      };
    }

    if (enrollment.status !== "active") {
      return {
        ok: false,
        message: "Bu ödeme yalnızca aktif kayıt dönemine işlenebilir.",
      };
    }

    /*
     * VADE STANDARDI
     *
     * Normal durumda ödeme vadesi kayıt başlangıç tarihidir.
     * Eski kayıtlarda payment_due_date boşsa start_date ile tamamlanır.
     * Onaylanmış özel bir vade zaten varsa üzerine yazılmaz.
     */
    if (!enrollment.payment_due_date && enrollment.start_date) {
      const { error: dueSyncError } = await supabase
        .from("student_enrollments")
        .update({
          payment_due_date: enrollment.start_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollmentId)
        .eq("organization_id", organizationId);

      if (dueSyncError) {
        console.error("payment due date sync error:", dueSyncError);
      }
    }

    const now = new Date().toISOString();

    /*
     * KASA MANTIĞI
     *
     * Nakit: personelin elinde.
     * Kart / havale / EFT: fiziki kasa teslimi gerektirmez.
     */
    const cashHandoverStatus =
      input.paymentMethod === "cash"
        ? "with_staff"
        : "main_cash_confirmed";

    const { data: payment, error: paymentError } = await supabase
      .from("student_payments")
      .insert({
        organization_id: organizationId,
        student_id: studentId,
        enrollment_id: enrollmentId,
        amount,
        currency: "TRY",
        payment_method: input.paymentMethod,
        payment_status: "received",
        description: cleanDescription(input.description),
        received_by: profile.id,
        received_at: now,
        cash_handover_status: cashHandoverStatus,
        cash_handover_requested_at: null,
        cash_handover_approved_by: null,
        cash_handover_approved_at:
          input.paymentMethod === "cash" ? null : now,
        cancellation_reason: null,
        cancelled_by: null,
        cancelled_at: null,
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return {
        ok: false,
        message: paymentError
          ? `Ödeme kaydedilemedi: ${paymentError.message}`
          : "Ödeme kaydedilemedi.",
      };
    }

    const studentName = `${student.first_name || ""} ${
      student.last_name || ""
    }`.trim();

    const methodLabel = paymentMethodLabel(input.paymentMethod);

    await addSystemNotification(supabase, {
      organizationId,
      createdBy: profile.id,
      category: "finance",
      eventKey: "payment_received",
      title: "Yeni ödeme alındı",
      message:
        `${studentName || "Öğrenci"} için ${amount.toLocaleString(
          "tr-TR"
        )} TL ${methodLabel} ödeme alındı.` +
        (input.paymentMethod === "cash"
          ? " Nakit personelde; kasa teslimi bekleniyor."
          : ""),
      severity: "success",
      entityType: "student_payment",
      entityId: payment.id,
      pushRequested: false,
      metadata: {
        student_id: studentId,
        enrollment_id: enrollmentId,
        amount,
        payment_method: input.paymentMethod,
        cash_handover_status: cashHandoverStatus,
      },
    });

    revalidateFinancePaths(studentId);

    return {
      ok: true,
      paymentId: payment.id,
      message: `${studentName} için ${amount.toLocaleString(
        "tr-TR"
      )} TL ödeme başarıyla kaydedildi.`.trim(),
    };
  } catch (error) {
    console.error("createStudentPayment error:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? `Ödeme kaydedilemedi: ${error.message}`
          : "Ödeme kaydedilirken beklenmeyen bir hata oluştu.",
    };
  }
}

/*
 * ----------------------------------------------------
 * KASAYA TESLİM TALEBİ
 * ----------------------------------------------------
 */
export async function requestCashHandover(
  paymentId: string
): Promise<PaymentActionResult> {
  try {
    const profile = await getAuthorizedProfile();
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!paymentId) {
      return {
        ok: false,
        message: "Ödeme kaydı bulunamadı.",
      };
    }

    const supabase = await createClient();

    const { data: payment, error: paymentError } = await supabase
      .from("student_payments")
      .select(
        "id,student_id,amount,payment_method,cash_handover_status,cancelled_at"
      )
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (paymentError || !payment) {
      return {
        ok: false,
        message: "Ödeme kaydı bulunamadı.",
      };
    }

    if (payment.cancelled_at) {
      return {
        ok: false,
        message: "İptal edilmiş ödeme kasaya teslim edilemez.",
      };
    }

    if (payment.payment_method !== "cash") {
      return {
        ok: false,
        message:
          "Kasa teslim işlemi yalnızca nakit ödemelerde kullanılabilir.",
      };
    }

    if (payment.cash_handover_status === "main_cash_confirmed") {
      return {
        ok: false,
        message: "Bu ödeme zaten ana kasaya teslim edilmiş.",
      };
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("student_payments")
      .update({
        cash_handover_status: "handoff_pending",
        cash_handover_requested_at: now,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId);

    if (error) {
      return {
        ok: false,
        message: `Kasa teslim talebi oluşturulamadı: ${error.message}`,
      };
    }

    const rule = await getApprovalRule(
      supabase,
      organizationId,
      "cash_handover_approve"
    );

    if (rule.dashboard_notification || rule.push_notification) {
      await addSystemNotification(supabase, {
        organizationId,
        createdBy: profile.id,
        category: "finance",
        eventKey: "cash_handover_requested",
        title: "Kasa teslimi bekliyor",
        message: `${Number(payment.amount || 0).toLocaleString(
          "tr-TR"
        )} TL nakit için ana kasa teslim onayı bekleniyor.`,
        severity: "warning",
        entityType: "student_payment",
        entityId: paymentId,
        pushRequested: rule.push_notification,
        metadata: {
          student_id: payment.student_id,
          payment_id: paymentId,
          amount: payment.amount,
        },
      });
    }

    revalidateFinancePaths(payment.student_id);

    return {
      ok: true,
      paymentId,
      message: "Kasa teslim talebi oluşturuldu.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Kasa teslim talebi oluşturulamadı.",
    };
  }
}

/*
 * ----------------------------------------------------
 * KASA TESLİM ONAYI
 * ----------------------------------------------------
 *
 * Bu işlem zaten yetkili kullanıcı tarafından yapılır.
 * Ayarlardaki Kasa Teslim Onayı kuralı bildirim/push davranışını belirler.
 */
export async function approveCashHandover(
  paymentId: string
): Promise<PaymentActionResult> {
  try {
    const profile = await requireProfile([
      "owner",
      "admin",
      "accounting",
    ]);

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    const supabase = await createClient();

    const { data: payment, error: paymentError } = await supabase
      .from("student_payments")
      .select(
        "id,student_id,amount,cash_handover_status,cancelled_at"
      )
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (paymentError || !payment) {
      return {
        ok: false,
        message: "Ödeme kaydı bulunamadı.",
      };
    }

    if (payment.cancelled_at) {
      return {
        ok: false,
        message: "İptal edilmiş ödeme onaylanamaz.",
      };
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("student_payments")
      .update({
        cash_handover_status: "main_cash_confirmed",
        cash_handover_approved_by: profile.id,
        cash_handover_approved_at: now,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId);

    if (error) {
      return {
        ok: false,
        message: `Kasa teslimi onaylanamadı: ${error.message}`,
      };
    }

    const rule = await getApprovalRule(
      supabase,
      organizationId,
      "cash_handover_approve"
    );

    if (rule.dashboard_notification || rule.push_notification) {
      await addSystemNotification(supabase, {
        organizationId,
        createdBy: profile.id,
        category: "finance",
        eventKey: "cash_handover_approved",
        title: "Nakit ana kasaya teslim edildi",
        message: `${Number(payment.amount || 0).toLocaleString(
          "tr-TR"
        )} TL nakit ana kasaya teslim edildi ve onaylandı.`,
        severity: "success",
        entityType: "student_payment",
        entityId: paymentId,
        pushRequested: rule.push_notification,
        metadata: {
          student_id: payment.student_id,
          payment_id: paymentId,
          amount: payment.amount,
        },
      });
    }

    revalidateFinancePaths(payment.student_id);

    return {
      ok: true,
      paymentId,
      message: "Ödeme ana kasaya teslim edildi.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Kasa teslimi onaylanamadı.",
    };
  }
}

/*
 * ----------------------------------------------------
 * ÖDEME VADE TARİHİ
 * ----------------------------------------------------
 *
 * Normal vade = kayıt başlangıç tarihi.
 * Farklı vade istenirse approval_rules kuralına göre:
 *
 * - Yönetici onayı AÇIK: approval_requests'e düşer.
 * - Yönetici onayı KAPALI: doğrudan uygulanır.
 *
 * paymentDueDate null gönderilirse vade start_date'e geri alınır.
 *
 * reason parametresi opsiyoneldir; mevcut payments-client çağrısını
 * bozmamak için varsayılan gerekçe üretir.
 */
export async function updatePaymentDueDate(
  enrollmentId: string,
  paymentDueDate: string | null,
  reason?: string | null
): Promise<PaymentActionResult> {
  try {
    const profile = await requireProfile([
      "owner",
      "admin",
      "branch_manager",
      "registration_staff",
      "accounting",
    ]);

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!enrollmentId) {
      return {
        ok: false,
        message: "Aktif kayıt bilgisi bulunamadı.",
      };
    }

    if (
      paymentDueDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(paymentDueDate)
    ) {
      return {
        ok: false,
        message: "Geçerli bir ödeme vade tarihi seçiniz.",
      };
    }

    const supabase = await createClient();

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .select(
        "id,student_id,status,start_date,payment_due_date"
      )
      .eq("id", enrollmentId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      return {
        ok: false,
        message: "Öğrencinin kayıt bilgisi bulunamadı.",
      };
    }

    if (enrollment.status !== "active") {
      return {
        ok: false,
        message:
          "Ödeme vadesi yalnızca aktif kayıt için değiştirilebilir.",
      };
    }

    const requestedDueDate =
      paymentDueDate || enrollment.start_date || null;

    if (!requestedDueDate) {
      return {
        ok: false,
        message:
          "Kayıt başlangıç tarihi bulunamadığı için vade belirlenemedi.",
      };
    }

    const currentDueDate =
      enrollment.payment_due_date ||
      enrollment.start_date ||
      null;

    if (currentDueDate === requestedDueDate) {
      return {
        ok: true,
        message: "Ödeme vadesi zaten seçilen tarihte.",
      };
    }

    const rule = await getApprovalRule(
      supabase,
      organizationId,
      "payment_due_date_change"
    );

    /*
     * Kural kapatılmışsa veya yönetici onayı devre dışıysa
     * değişiklik doğrudan uygulanabilir.
     */
    if (!rule.is_active || !rule.requires_approval) {
      const { error } = await supabase
        .from("student_enrollments")
        .update({
          payment_due_date: requestedDueDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollmentId)
        .eq("organization_id", organizationId);

      if (error) {
        return {
          ok: false,
          message: `Ödeme vadesi kaydedilemedi: ${error.message}`,
        };
      }

      if (rule.dashboard_notification || rule.push_notification) {
        await addSystemNotification(supabase, {
          organizationId,
          createdBy: profile.id,
          category: "finance",
          eventKey: "payment_due_date_changed",
          title: "Ödeme vadesi değiştirildi",
          message: `Ödeme vadesi ${
            currentDueDate || "belirtilmemiş"
          } tarihinden ${requestedDueDate} tarihine değiştirildi.`,
          severity: "info",
          entityType: "student_enrollment",
          entityId: enrollmentId,
          pushRequested: rule.push_notification,
          metadata: {
            student_id: enrollment.student_id,
            old_due_date: currentDueDate,
            new_due_date: requestedDueDate,
          },
        });
      }

      revalidateFinancePaths(enrollment.student_id);

      return {
        ok: true,
        message: "Ödeme vade tarihi başarıyla güncellendi.",
      };
    }

    /*
     * Yönetici onayı açık:
     * Tarihi değiştirme, sadece talep oluştur.
     */
    const requestReason =
      cleanReason(reason) ||
      "Ödeme Merkezi üzerinden vade tarihi değişikliği talebi.";

    const request = await createApprovalRequest(supabase, {
      organizationId,
      requestType: "payment_due_date_change",
      module: "finance",
      entityType: "student_enrollment",
      entityId: enrollmentId,
      studentId: enrollment.student_id,
      requestedBy: profile.id,
      reason: requestReason,
      oldValues: {
        payment_due_date: currentDueDate,
        start_date: enrollment.start_date,
      },
      newValues: {
        payment_due_date: requestedDueDate,
      },
    });

    if (rule.dashboard_notification || rule.push_notification) {
      await addSystemNotification(supabase, {
        organizationId,
        createdBy: profile.id,
        category: "approval",
        eventKey: "payment_due_date_change_requested",
        title: "Vade değişikliği onay bekliyor",
        message: `Ödeme vadesinin ${
          currentDueDate || "belirtilmemiş"
        } tarihinden ${requestedDueDate} tarihine alınması için yönetici onayı bekleniyor.`,
        severity: "warning",
        entityType: "approval_request",
        entityId: request.id,
        pushRequested: rule.push_notification,
        metadata: {
          student_id: enrollment.student_id,
          enrollment_id: enrollmentId,
          old_due_date: currentDueDate,
          new_due_date: requestedDueDate,
        },
      });
    }

    revalidateFinancePaths(enrollment.student_id);

    return {
      ok: true,
      approvalRequestId: request.id,
      message: request.alreadyExists
        ? "Bu kayıt için bekleyen bir vade değişikliği talebi zaten var."
        : "Vade değişikliği yönetici onayına gönderildi.",
    };
  } catch (error) {
    console.error("updatePaymentDueDate error:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? `Ödeme vadesi işlenemedi: ${error.message}`
          : "Ödeme vadesi işlenirken beklenmeyen bir hata oluştu.",
    };
  }
}

/*
 * ----------------------------------------------------
 * ÖDEME DÜZELTME TALEBİ
 * ----------------------------------------------------
 *
 * UI bu fonksiyonu bağladığında ödeme tutarı, yöntem veya açıklama
 * değişikliği doğrudan uygulanmayacak; varsayılan kurala göre
 * Onay Merkezi'ne düşecek.
 */
export async function requestPaymentEdit(
  paymentId: string,
  changes: PaymentEditChanges,
  reason: string
): Promise<PaymentActionResult> {
  try {
    const profile = await getAuthorizedProfile();
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!paymentId) {
      return {
        ok: false,
        message: "Ödeme kaydı bulunamadı.",
      };
    }

    const requestReason = cleanReason(reason);

    if (!requestReason) {
      return {
        ok: false,
        message: "Düzeltme talebi için gerekçe zorunludur.",
      };
    }

    const supabase = await createClient();

    const { data: payment, error } = await supabase
      .from("student_payments")
      .select(
        "id,student_id,enrollment_id,amount,payment_method,description,payment_status,cash_handover_status,cancelled_at"
      )
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !payment) {
      return {
        ok: false,
        message: "Ödeme kaydı bulunamadı.",
      };
    }

    if (payment.cancelled_at || payment.payment_status === "cancelled") {
      return {
        ok: false,
        message: "İptal edilmiş ödeme düzeltilemez.",
      };
    }

    const newAmount =
      changes.amount === undefined
        ? Number(payment.amount)
        : normalizeAmount(changes.amount);

    if (newAmount === null) {
      return {
        ok: false,
        message: "Geçerli bir ödeme tutarı giriniz.",
      };
    }

    const newMethod =
      changes.paymentMethod === undefined
        ? (payment.payment_method as PaymentMethod)
        : changes.paymentMethod;

    if (!ALLOWED_METHODS.includes(newMethod)) {
      return {
        ok: false,
        message: "Geçersiz ödeme yöntemi.",
      };
    }

    const newDescription =
      changes.description === undefined
        ? payment.description
        : cleanDescription(changes.description);

    const rule = await getApprovalRule(
      supabase,
      organizationId,
      "payment_edit"
    );

    /*
     * Kritik finans hareketlerinde güvenli varsayılan onaydır.
     * Kural açıkken sadece talep oluşturulur.
     */
    if (rule.is_active && rule.requires_approval) {
      const request = await createApprovalRequest(supabase, {
        organizationId,
        requestType: "payment_edit",
        module: "finance",
        entityType: "student_payment",
        entityId: paymentId,
        studentId: payment.student_id,
        requestedBy: profile.id,
        reason: requestReason,
        oldValues: {
          amount: payment.amount,
          payment_method: payment.payment_method,
          description: payment.description,
        },
        newValues: {
          amount: newAmount,
          payment_method: newMethod,
          description: newDescription,
        },
      });

      if (rule.dashboard_notification || rule.push_notification) {
        await addSystemNotification(supabase, {
          organizationId,
          createdBy: profile.id,
          category: "approval",
          eventKey: "payment_edit_requested",
          title: "Ödeme düzeltme onayı bekliyor",
          message: `${Number(payment.amount || 0).toLocaleString(
            "tr-TR"
          )} TL tutarındaki ödeme için düzeltme talebi oluşturuldu.`,
          severity: "warning",
          entityType: "approval_request",
          entityId: request.id,
          pushRequested: rule.push_notification,
          metadata: {
            payment_id: paymentId,
            student_id: payment.student_id,
          },
        });
      }

      revalidateFinancePaths(payment.student_id);

      return {
        ok: true,
        paymentId,
        approvalRequestId: request.id,
        message: request.alreadyExists
          ? "Bu ödeme için bekleyen bir düzeltme talebi zaten var."
          : "Ödeme düzeltme talebi yönetici onayına gönderildi.",
      };
    }

    /*
     * Ayardan yönetici onayı kapatılmışsa doğrudan uygula.
     * Ödeme yönteminin nakit/nakit dışı değişmesi kasa statüsünü
     * güvenli başlangıç durumuna taşır.
     */
    const nextCashStatus =
      newMethod === "cash"
        ? "with_staff"
        : "main_cash_confirmed";

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("student_payments")
      .update({
        amount: newAmount,
        payment_method: newMethod,
        description: newDescription,
        cash_handover_status: nextCashStatus,
        cash_handover_requested_at: null,
        cash_handover_approved_by:
          newMethod === "cash" ? null : profile.id,
        cash_handover_approved_at:
          newMethod === "cash" ? null : now,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId);

    if (updateError) {
      return {
        ok: false,
        message: `Ödeme düzeltilemedi: ${updateError.message}`,
      };
    }

    if (rule.dashboard_notification || rule.push_notification) {
      await addSystemNotification(supabase, {
        organizationId,
        createdBy: profile.id,
        category: "finance",
        eventKey: "payment_edited",
        title: "Ödeme düzeltildi",
        message: `${Number(payment.amount || 0).toLocaleString(
          "tr-TR"
        )} TL tutarındaki ödeme kaydı düzeltildi.`,
        severity: "info",
        entityType: "student_payment",
        entityId: paymentId,
        pushRequested: rule.push_notification,
        metadata: {
          student_id: payment.student_id,
          old_amount: payment.amount,
          new_amount: newAmount,
          old_payment_method: payment.payment_method,
          new_payment_method: newMethod,
        },
      });
    }

    revalidateFinancePaths(payment.student_id);

    return {
      ok: true,
      paymentId,
      message: "Ödeme kaydı güncellendi.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Ödeme düzeltme talebi oluşturulamadı.",
    };
  }
}

/*
 * ----------------------------------------------------
 * ÖDEME İPTAL / SİLME TALEBİ
 * ----------------------------------------------------
 *
 * Gerçek DELETE yapılmaz.
 * Onay sonrasında payment_status='cancelled' kullanılır.
 */
export async function requestPaymentCancellation(
  paymentId: string,
  reason: string
): Promise<PaymentActionResult> {
  try {
    const profile = await getAuthorizedProfile();
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    const requestReason = cleanReason(reason);

    if (!paymentId) {
      return {
        ok: false,
        message: "Ödeme kaydı bulunamadı.",
      };
    }

    if (!requestReason) {
      return {
        ok: false,
        message: "Ödeme iptal talebi için gerekçe zorunludur.",
      };
    }

    const supabase = await createClient();

    const { data: payment, error } = await supabase
      .from("student_payments")
      .select(
        "id,student_id,enrollment_id,amount,payment_method,payment_status,cash_handover_status,cancelled_at"
      )
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !payment) {
      return {
        ok: false,
        message: "Ödeme kaydı bulunamadı.",
      };
    }

    if (payment.cancelled_at || payment.payment_status === "cancelled") {
      return {
        ok: false,
        message: "Bu ödeme zaten iptal edilmiş.",
      };
    }

    const rule = await getApprovalRule(
      supabase,
      organizationId,
      "payment_cancel"
    );

    if (rule.is_active && rule.requires_approval) {
      const request = await createApprovalRequest(supabase, {
        organizationId,
        requestType: "payment_cancel",
        module: "finance",
        entityType: "student_payment",
        entityId: paymentId,
        studentId: payment.student_id,
        requestedBy: profile.id,
        reason: requestReason,
        oldValues: {
          amount: payment.amount,
          payment_method: payment.payment_method,
          payment_status: payment.payment_status,
          cash_handover_status: payment.cash_handover_status,
        },
        newValues: {
          payment_status: "cancelled",
          cancellation_reason: requestReason,
        },
      });

      if (rule.dashboard_notification || rule.push_notification) {
        await addSystemNotification(supabase, {
          organizationId,
          createdBy: profile.id,
          category: "approval",
          eventKey: "payment_cancel_requested",
          title: "Ödeme iptal onayı bekliyor",
          message: `${Number(payment.amount || 0).toLocaleString(
            "tr-TR"
          )} TL tutarındaki ödeme için iptal talebi oluşturuldu.`,
          severity: "warning",
          entityType: "approval_request",
          entityId: request.id,
          pushRequested: rule.push_notification,
          metadata: {
            payment_id: paymentId,
            student_id: payment.student_id,
            amount: payment.amount,
          },
        });
      }

      revalidateFinancePaths(payment.student_id);

      return {
        ok: true,
        paymentId,
        approvalRequestId: request.id,
        message: request.alreadyExists
          ? "Bu ödeme için bekleyen bir iptal talebi zaten var."
          : "Ödeme iptal talebi yönetici onayına gönderildi.",
      };
    }

    const now = new Date().toISOString();

    const { error: cancelError } = await supabase
      .from("student_payments")
      .update({
        payment_status: "cancelled",
        cancellation_reason: requestReason,
        cancelled_by: profile.id,
        cancelled_at: now,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId);

    if (cancelError) {
      return {
        ok: false,
        message: `Ödeme iptal edilemedi: ${cancelError.message}`,
      };
    }

    if (rule.dashboard_notification || rule.push_notification) {
      await addSystemNotification(supabase, {
        organizationId,
        createdBy: profile.id,
        category: "finance",
        eventKey: "payment_cancelled",
        title: "Ödeme iptal edildi",
        message: `${Number(payment.amount || 0).toLocaleString(
          "tr-TR"
        )} TL tutarındaki ödeme iptal edildi.`,
        severity: "warning",
        entityType: "student_payment",
        entityId: paymentId,
        pushRequested: rule.push_notification,
        metadata: {
          student_id: payment.student_id,
          amount: payment.amount,
          cancellation_reason: requestReason,
        },
      });
    }

    revalidateFinancePaths(payment.student_id);

    return {
      ok: true,
      paymentId,
      message: "Ödeme iptal edildi.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Ödeme iptal talebi oluşturulamadı.",
    };
  }
}
