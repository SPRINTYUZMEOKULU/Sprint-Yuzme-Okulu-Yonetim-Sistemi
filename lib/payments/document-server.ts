import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isReceivedPayment } from "./document-rules";
export function documentAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Ödeme sistemi bağlantısı yapılandırılmamış.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function currentDocumentFinance(organizationId: string, studentId: string) {
  const db = documentAdmin();
  const [student, enrollment] = await Promise.all([
    db.from("students").select("id").eq("organization_id", organizationId).eq("id", studentId).maybeSingle(),
    db.from("student_enrollments").select("id,package_id,start_date,planned_end_date").eq("organization_id", organizationId).eq("student_id", studentId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (student.error || enrollment.error) throw new Error("Kursiyer ve kayıt dönemi okunamadı.");
  if (!student.data) throw new Error("Kursiyer bulunamadı.");
  if (!enrollment.data?.package_id) return { enrollment: enrollment.data, packageName: "", remaining: 0 };
  const [pack, payments] = await Promise.all([
    db.from("course_packages").select("name,price").eq("organization_id", organizationId).eq("id", enrollment.data.package_id).maybeSingle(),
    db.from("student_payments").select("amount,payment_status,cancelled_at").eq("organization_id", organizationId).eq("student_id", studentId).eq("enrollment_id", enrollment.data.id),
  ]);
  if (pack.error || payments.error || !pack.data) throw new Error("Güncel borç bilgisi okunamadı.");
  const received = (payments.data || []).filter(isReceivedPayment).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { enrollment: enrollment.data, packageName: pack.data.name, remaining: Math.round(Math.max(0, Number(pack.data.price || 0) - received) * 100) / 100 };
}
