import { createClient } from "@supabase/supabase-js";

export async function correctPackagePayment(input: {
  organizationId: string;
  actorId: string;
  paymentId: string;
  expected: Record<string, unknown>;
  reason: string;
  cancellation?: boolean;
  amount?: number;
  method?: string;
  description?: string | null;
  apply: boolean;
  approvalId?: string;
  review?: { name: string; note: string | null };
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Finans bağlantısı yapılandırılmamış.");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.rpc("correct_student_package_payment", {
    p_organization: input.organizationId,
    p_actor: input.actorId,
    p_payment: input.paymentId,
    p_expected: input.expected,
    p_cancel: Boolean(input.cancellation),
    p_amount: input.amount ?? null,
    p_method: input.method ?? null,
    p_description: input.description ?? null,
    p_reason: input.reason,
    p_apply: input.apply,
    p_approval: input.approvalId ?? null,
    p_review: input.review ?? null,
  });
  if (error) {
    if (error.code === "P0001") throw new Error(error.message);
    console.error("Tahsilat düzeltme:", error);
    throw new Error("Tahsilat işlemi tamamlanamadı.");
  }
}
