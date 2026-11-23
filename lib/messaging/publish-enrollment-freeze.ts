import "server-only";
import { createHash } from "node:crypto";
import { deliverPortalMessage } from "./deliver-portal-message";
import { enrollmentFreezeMessage } from "./enrollment-freeze-message";

export async function publishEnrollmentFreeze(
  organizationId: string,
  actorId: string,
  item: { id: string; student_id: string; status: string; new_values: Record<string, unknown> },
) {
  const hash = createHash("sha256").update(`${item.id}:${item.status}`).digest("hex");
  const deliveryId = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  try {
    const delivery = await deliverPortalMessage({
      organizationId, studentId: item.student_id, actorId, deliveryId,
      title: "Kayıt Dondurma Bilgilendirmesi",
      message: enrollmentFreezeMessage(item.status, item.new_values),
    });
    return delivery.failed ? "Veli bildiriminin teslimini kontrol edin."
      : delivery.saved ? "Veli paneline bilgi gönderildi."
      : "Veli panelinde mesaj alabilen bir hesap bulunamadı.";
  } catch (error) {
    console.error("Enrollment freeze guardian delivery failed", error);
    return "Veli paneli bildirimi gönderilemedi.";
  }
}
