"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";

type InstallmentInput = { dueDate: string; amount: number };
type PlanInput = {
  studentId: string;
  enrollmentId: string;
  totalAmount: number;
  note?: string | null;
  installments: InstallmentInput[];
};

const roles = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
] as const;
const rounded = (value: number) => Math.round(Number(value || 0) * 100) / 100;

export async function saveStudentPaymentPlan(input: PlanInput) {
  try {
    const profile = await requireProfile([...roles]);
    if (!profile.organization_id || !input.studentId || !input.enrollmentId)
      return { ok: false, message: "Öğrenci ve kayıt bilgisi eksik." };
    if (!input.installments.length || input.installments.length > 24)
      return {
        ok: false,
        message: "1 ile 24 arasında taksit oluşturabilirsiniz.",
      };

    const totalAmount = rounded(input.totalAmount);
    const installmentTotal = rounded(
      input.installments.reduce((sum, item) => sum + rounded(item.amount), 0),
    );
    if (totalAmount <= 0 || Math.abs(totalAmount - installmentTotal) > 0.01)
      return {
        ok: false,
        message: "Taksit toplamı plan tutarıyla eşleşmelidir.",
      };
    if (
      input.installments.some(
        (item) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ||
          rounded(item.amount) <= 0,
      )
    )
      return {
        ok: false,
        message: "Taksit tarihlerini ve tutarlarını kontrol ediniz.",
      };

    const supabase = await createClient();
    const { data: enrollment } = await supabase
      .from("student_enrollments")
      .select("id,student_id,status")
      .eq("organization_id", profile.organization_id)
      .eq("id", input.enrollmentId)
      .eq("student_id", input.studentId)
      .eq("status", "active")
      .maybeSingle();
    if (!enrollment)
      return { ok: false, message: "Aktif öğrenci kaydı bulunamadı." };

    const { data: existing } = await supabase
      .from("student_payment_plans")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("enrollment_id", input.enrollmentId)
      .maybeSingle();
    let planId = existing?.id as string | undefined;
    if (planId) {
      const { data: paidRows } = await supabase
        .from("student_payment_installments")
        .select("id")
        .eq("plan_id", planId)
        .gt("paid_amount", 0)
        .limit(1);
      if (paidRows?.length)
        return {
          ok: false,
          message:
            "Ödeme alınmış bir plan yeniden kurulamaz. Vade değişikliği için yönetici onayı kullanılmalıdır.",
        };
      const { error } = await supabase
        .from("student_payment_plans")
        .update({
          total_amount: totalAmount,
          installment_count: input.installments.length,
          status: "active",
          note:
            String(input.note || "")
              .trim()
              .slice(0, 1000) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);
      if (error) throw error;
      const { error: deleteError } = await supabase
        .from("student_payment_installments")
        .delete()
        .eq("plan_id", planId);
      if (deleteError) throw deleteError;
    } else {
      const { data, error } = await supabase
        .from("student_payment_plans")
        .insert({
          organization_id: profile.organization_id,
          student_id: input.studentId,
          enrollment_id: input.enrollmentId,
          total_amount: totalAmount,
          installment_count: input.installments.length,
          status: "active",
          note:
            String(input.note || "")
              .trim()
              .slice(0, 1000) || null,
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (error || !data)
        throw error || new Error("Ödeme planı oluşturulamadı.");
      planId = data.id;
    }

    const { error: installmentError } = await supabase
      .from("student_payment_installments")
      .insert(
        input.installments.map((item, index) => ({
          organization_id: profile.organization_id,
          plan_id: planId,
          student_id: input.studentId,
          enrollment_id: input.enrollmentId,
          sequence_no: index + 1,
          due_date: item.dueDate,
          amount: rounded(item.amount),
          paid_amount: 0,
          status: "pending",
        })),
      );
    if (installmentError) throw installmentError;

    await supabase
      .from("student_enrollments")
      .update({
        payment_due_date: input.installments[0].dueDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.enrollmentId)
      .eq("organization_id", profile.organization_id);
    await createNotification({
      organizationId: profile.organization_id,
      category: "finance",
      eventKey: "payment_plan_created",
      notificationType: "payment_plan_created",
      title: "Ödeme planı hazırlandı",
      body: `${input.installments.length} taksit · ${totalAmount.toLocaleString("tr-TR")} TL`,
      severity: "success",
      priority: "normal",
      studentId: input.studentId,
      sourceType: "student_payment_plan",
      sourceId: planId,
      targetPath: `/ogrenciler/${input.studentId}?payment=plan`,
      recipientProfileIds: [profile.id],
      push: false,
    });
    revalidatePath(`/ogrenciler/${input.studentId}`);
    revalidatePath("/odemeler");
    revalidatePath("/veli-odemeler");
    return { ok: true, message: "Ödeme planı başarıyla kaydedildi." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Ödeme planı kaydedilemedi: ${error.message}`
          : "Ödeme planı kaydedilemedi.",
    };
  }
}
