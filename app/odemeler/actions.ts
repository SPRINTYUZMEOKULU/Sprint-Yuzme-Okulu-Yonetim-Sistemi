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

  /*
   * İleride ödeme vade planına
   * bağlamak için hazır bırakıyoruz.
   */
  dueDate?: string | null;
};

type PaymentActionResult = {
  ok: boolean;
  paymentId?: string;
  message: string;
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
  return requireProfile([
    ...ALLOWED_ROLES,
  ]);
}

function cleanDescription(
  value?: string | null
) {
  const text = String(value || "").trim();

  return text.length
    ? text.slice(0, 1000)
    : null;
}

function normalizeAmount(
  value: unknown
) {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return Math.round(
    amount * 100
  ) / 100;
}

/*
 * ----------------------------------------------------
 * YENİ ÖDEME AL
 * ----------------------------------------------------
 *
 * Bütün ödeme girişleri aynı tabloya gider:
 *
 * student_payments
 *
 * Böylece:
 *
 * Ödeme Merkezi
 * Öğrenci Merkezi
 * Öğrenci Dosyası
 * Günlük Kasa
 * Veli Ödemeleri
 *
 * aynı ödeme hareketini okuyabilir.
 */
export async function createStudentPayment(
  input: CreatePaymentInput
): Promise<PaymentActionResult> {
  try {
    const profile =
      await getAuthorizedProfile();

    const organizationId =
      profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message:
          "Organizasyon bilgisi bulunamadı.",
      };
    }

    const studentId =
      String(
        input.studentId || ""
      ).trim();

    const enrollmentId =
      String(
        input.enrollmentId || ""
      ).trim();

    if (
      !studentId ||
      !enrollmentId
    ) {
      return {
        ok: false,
        message:
          "Öğrenci ve aktif kayıt bilgisi zorunludur.",
      };
    }

    const amount =
      normalizeAmount(
        input.amount
      );

    if (amount === null) {
      return {
        ok: false,
        message:
          "Geçerli bir ödeme tutarı giriniz.",
      };
    }

    if (
      !ALLOWED_METHODS.includes(
        input.paymentMethod
      )
    ) {
      return {
        ok: false,
        message:
          "Geçersiz ödeme yöntemi.",
      };
    }

    const supabase =
      await createClient();

    /*
     * ------------------------------------------------
     * ÖĞRENCİ DOĞRULAMA
     * ------------------------------------------------
     */

    const {
      data: student,
      error: studentError,
    } = await supabase
      .from("students")
      .select(
        "id, organization_id, first_name, last_name"
      )
      .eq(
        "id",
        studentId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "is_deleted",
        false
      )
      .maybeSingle();

    if (
      studentError ||
      !student
    ) {
      return {
        ok: false,
        message:
          "Öğrenci bulunamadı veya bu kuruma ait değil.",
      };
    }

    /*
     * ------------------------------------------------
     * AKTİF KAYIT DOĞRULAMA
     * ------------------------------------------------
     *
     * Ödeme mutlaka ilgili enrollment'a bağlanır.
     * Böylece eski paket ödemesi yeni pakete karışmaz.
     */

    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabase
      .from("student_enrollments")
      .select(
        "id, student_id, organization_id, status"
      )
      .eq(
        "id",
        enrollmentId
      )
      .eq(
        "student_id",
        studentId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (
      enrollmentError ||
      !enrollment
    ) {
      return {
        ok: false,
        message:
          "Öğrencinin kayıt/paket dönemi bulunamadı.",
      };
    }

    if (
      enrollment.status !==
      "active"
    ) {
      return {
        ok: false,
        message:
          "Bu ödeme yalnızca aktif kayıt dönemine işlenebilir.",
      };
    }

    const now =
      new Date().toISOString();

    /*
     * ------------------------------------------------
     * KASA MANTIĞI
     * ------------------------------------------------
     *
     * Nakit ödeme:
     * personelin elinde kabul edilir.
     *
     * Kart/Havale/EFT:
     * fiziki kasa teslimi gerekmez.
     */

    const cashHandoverStatus =
      input.paymentMethod ===
      "cash"
        ? "with_staff"
        : "main_cash_confirmed";

    /*
     * ------------------------------------------------
     * ÖDEME KAYDI
     * ------------------------------------------------
     */

    const {
      data: payment,
      error: paymentError,
    } = await supabase
      .from("student_payments")
      .insert({
        organization_id:
          organizationId,

        student_id:
          studentId,

        enrollment_id:
          enrollmentId,

        amount,

        currency:
          "TRY",

        payment_method:
          input.paymentMethod,

        payment_status:
          "completed",

        description:
          cleanDescription(
            input.description
          ),

        received_by:
          profile.id,

        received_at:
          now,

        cash_handover_status:
          cashHandoverStatus,

        cash_handover_requested_at:
          null,

        cash_handover_approved_by:
          null,

        cash_handover_approved_at:
          input.paymentMethod ===
          "cash"
            ? null
            : now,

        cancellation_reason:
          null,

        cancelled_by:
          null,

        cancelled_at:
          null,
      })
      .select("id")
      .single();

    if (
      paymentError ||
      !payment
    ) {
      return {
        ok: false,
        message:
          paymentError
            ? `Ödeme kaydedilemedi: ${paymentError.message}`
            : "Ödeme kaydedilemedi.",
      };
    }

    /*
     * ------------------------------------------------
     * TÜM BAĞLI MODÜLLERİ YENİLE
     * ------------------------------------------------
     *
     * Aynı ödeme hareketinin tüm ekranlarda
     * güncel görünmesini sağlar.
     */

    revalidatePath(
      "/odemeler"
    );

    revalidatePath(
      "/ogrenciler"
    );

    revalidatePath(
      `/ogrenciler/${studentId}`
    );

    revalidatePath(
      "/kasa"
    );

    revalidatePath(
      "/veli-odemeler"
    );

    revalidatePath("/");

    return {
      ok: true,
      paymentId:
        payment.id,

      message:
        `${student.first_name || ""} ${
          student.last_name || ""
        } için ${amount.toLocaleString(
          "tr-TR"
        )} TL ödeme başarıyla kaydedildi.`.trim(),
    };
  } catch (error) {
    console.error(
      "createStudentPayment error:",
      error
    );

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
 *
 * Nakit ödeme alan personelin parayı
 * ana kasaya teslim etmek için işaretlemesi.
 */
export async function requestCashHandover(
  paymentId: string
): Promise<PaymentActionResult> {
  try {
    const profile =
      await getAuthorizedProfile();

    const organizationId =
      profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message:
          "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!paymentId) {
      return {
        ok: false,
        message:
          "Ödeme kaydı bulunamadı.",
      };
    }

    const supabase =
      await createClient();

    const {
      data: payment,
      error: paymentError,
    } = await supabase
      .from("student_payments")
      .select(
        "id, payment_method, cash_handover_status, cancelled_at"
      )
      .eq(
        "id",
        paymentId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (
      paymentError ||
      !payment
    ) {
      return {
        ok: false,
        message:
          "Ödeme kaydı bulunamadı.",
      };
    }

    if (payment.cancelled_at) {
      return {
        ok: false,
        message:
          "İptal edilmiş ödeme kasaya teslim edilemez.",
      };
    }

    if (
      payment.payment_method !==
      "cash"
    ) {
      return {
        ok: false,
        message:
          "Kasa teslim işlemi yalnızca nakit ödemelerde kullanılabilir.",
      };
    }

    if (
      payment.cash_handover_status ===
      "main_cash_confirmed"
    ) {
      return {
        ok: false,
        message:
          "Bu ödeme zaten ana kasaya teslim edilmiş.",
      };
    }

    const now =
      new Date().toISOString();

    const { error } =
      await supabase
        .from("student_payments")
        .update({
          cash_handover_status:
            "handoff_pending",

          cash_handover_requested_at:
            now,
        })
        .eq(
          "id",
          paymentId
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (error) {
      return {
        ok: false,
        message:
          `Kasa teslim talebi oluşturulamadı: ${error.message}`,
      };
    }

    revalidatePath(
      "/odemeler"
    );

    revalidatePath(
      "/kasa"
    );

    revalidatePath("/");

    return {
      ok: true,
      paymentId,

      message:
        "Kasa teslim talebi oluşturuldu.",
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
 * Yetkili kullanıcı nakdi teslim aldığında.
 */
export async function approveCashHandover(
  paymentId: string
): Promise<PaymentActionResult> {
  try {
    const profile =
      await requireProfile([
        "owner",
        "admin",
        "accounting",
      ]);

    const organizationId =
      profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        message:
          "Organizasyon bilgisi bulunamadı.",
      };
    }

    const supabase =
      await createClient();

    const {
      data: payment,
      error: paymentError,
    } = await supabase
      .from("student_payments")
      .select(
        "id, cash_handover_status, cancelled_at"
      )
      .eq(
        "id",
        paymentId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (
      paymentError ||
      !payment
    ) {
      return {
        ok: false,
        message:
          "Ödeme kaydı bulunamadı.",
      };
    }

    if (payment.cancelled_at) {
      return {
        ok: false,
        message:
          "İptal edilmiş ödeme onaylanamaz.",
      };
    }

    const now =
      new Date().toISOString();

    const { error } =
      await supabase
        .from("student_payments")
        .update({
          cash_handover_status:
            "main_cash_confirmed",

          cash_handover_approved_by:
            profile.id,

          cash_handover_approved_at:
            now,
        })
        .eq(
          "id",
          paymentId
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (error) {
      return {
        ok: false,
        message:
          `Kasa teslimi onaylanamadı: ${error.message}`,
      };
    }

    revalidatePath(
      "/odemeler"
    );

    revalidatePath(
      "/kasa"
    );

    revalidatePath("/");

    return {
      ok: true,
      paymentId,

      message:
        "Ödeme ana kasaya teslim edildi.",
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
