"use server";

import { createHmac } from "node:crypto";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { getGuardianContext } from "@/lib/guardian/data";
import { guardianObligationSummary, guardianPaymentSummary } from "@/lib/guardian/payment-summary";
import { documentAdmin } from "@/lib/payments/document-admin";

export async function openGuardianBankPayment(studentId: string, formData: FormData) {
  const profile = await requireProfile(["guardian"]);
  const back = (message: string): never =>
    redirect(`/veli-odemeler?child=${encodeURIComponent(studentId)}&paymentError=${encodeURIComponent(message)}#guvenli-odeme`);
  const data = await getGuardianContext(profile.id, studentId, "payments");
  const org = profile.organization_id;
  if (!org || data.selected?.id !== studentId) return back("Kursiyere erişim doğrulanamadı.");
  if (data.issues.some(issue => issue.startsWith("Ödeme") || issue.startsWith("Kayıt"))) return back("Ödeme bilgileri şu anda doğrulanamadı.");

  const { debt } = guardianPaymentSummary(data.enrollment, data.coursePackage, data.payments, data.paymentPlan);
  const target = formData.get("payment_target");
  const obligation = guardianObligationSummary(data.obligations || []).open.find(row => row.id === target);
  const packagePayment = target === "package";
  const balance = packagePayment && data.enrollment?.id
    ? debt
    : obligation ? Number(obligation.amount) - Number(obligation.paid_amount || 0) : 0;
  const amount = Math.round(balance * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return back("Güncel kayıtta açık borç bulunmuyor.");

  const db = documentAdmin();
  const enrollmentId = packagePayment ? data.enrollment?.id : obligation?.enrollment_id ?? null;
  const scope = db.from("payment_document_requests").select("id,public_token,status,expires_at,payment_id,expected_amount,enrollment_id")
    .eq("organization_id", org).eq("student_id", studentId).eq("created_by", profile.id);
  const { data: latest, error } = await scope
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) return back("Mevcut ödeme işlemi kontrol edilemedi.");

  if (latest && !latest.payment_id &&
      ["waiting_customer", "customer_completed", "waiting_payment", "error"].includes(latest.status)) {
    const valid = Date.parse(latest.expires_at) > Date.now();
    if (valid && Number(latest.expected_amount) === amount && latest.enrollment_id === enrollmentId) redirect(`/odeme-belge/${latest.public_token}?kaynak=veli`);
    if (latest.status !== "waiting_customer") {
      return back("Önceki havale işleminizin durumu için Sprint yönetimiyle iletişime geçiniz.");
    }
    const { data: cancelled, error: cancelError } = await db.from("payment_document_requests")
      .update({ status: "cancelled" }).eq("id", latest.id).eq("organization_id", org)
      .eq("created_by", profile.id).eq("status", "waiting_customer").is("payment_id", null).select("id").maybeSingle();
    if (cancelError || !cancelled) return back("Ödeme işlemi güncellenmiş. Lütfen tekrar deneyiniz.");
  }

  // Concurrent clicks against the same prior request resolve to the same new request.
  const hash = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(JSON.stringify(["guardian-bank-payment", org, studentId, profile.id, latest?.id ?? null])).digest("hex");
  const token = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  const { error: writeError } = await db.from("payment_document_requests").upsert({
    public_token: token,
    organization_id: org,
    student_id: studentId,
    enrollment_id: enrollmentId,
    expected_amount: amount,
    payment_method: "bank_transfer",
    status: "waiting_customer",
    document_provider: "nettefatura",
    document_type: "pending_classification",
    created_by: profile.id,
  }, { onConflict: "public_token", ignoreDuplicates: true });
  if (writeError) return back("Ödeme işlemi başlatılamadı. Lütfen tekrar deneyiniz.");
  const { data: opened, error: verifyError } = await db.from("payment_document_requests")
    .select("enrollment_id,expected_amount,status")
    .eq("organization_id", org).eq("student_id", studentId).eq("created_by", profile.id)
    .eq("public_token", token).maybeSingle();
  if (verifyError || !opened || opened.status === "cancelled" ||
      opened.enrollment_id !== enrollmentId || Number(opened.expected_amount) !== amount) {
    return back("Başka bir ödeme işlemi hazırlanmış. Lütfen sayfayı yenileyip tekrar deneyiniz.");
  }
  redirect(`/odeme-belge/${token}?kaynak=veli`);
}
