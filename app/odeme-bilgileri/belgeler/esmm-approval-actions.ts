"use server";

import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { revalidatePath } from "next/cache";

export async function approveEsmmPreparation(requestId: string) {
  const profile = await requireProfile(["owner","admin"]);
  if (!profile.organization_id) return { ok:false, message:"Kurum bilgisi bulunamadı." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return { ok:false, message:"Geçersiz belge talebi." };
  }
  const db = documentAdmin();
  const { data, error } = await db.rpc("approve_esmm_issue_request", {
    p_organization_id:profile.organization_id,
    p_request_id:requestId,
    p_actor_id:profile.id
  });
  if (error) return { ok:false, message:"e-SMM ön onay altyapısı hazır değil. Herhangi bir belge gönderilmedi." };
  const response = Array.isArray(data) ? data[0] : null;
  if (!response?.ok) {
    const reasons:Record<string,string> = {
      actor_not_authorized:"Yönetici yetkisi doğrulanamadı.",
      request_not_found:"Belge talebi bulunamadı.",
      request_not_ready:"Belge alıcısı, e-SMM türü veya belge aşaması eksik. İşlemi tekrar inceleyiniz.",
      payment_not_ready:"Kesinleşmiş tahsilat bilgileri uygun değil veya değişmiş.",
      already_approved:"Bu talep ya da tahsilat için daha önce ön onay verilmiş. Mükerrer işlem engellendi."
    };
    return { ok:false, message:reasons[response?.result_code] || "Ön onay verilemedi. İşlem kontrol edilmeli." };
  }
  revalidatePath("/odeme-bilgileri/belgeler");
  revalidatePath("/fatura-merkezi");
  return { ok:true, message:"Tekil e-SMM ön onayı kaydedildi. İşNet'e gönderim yapılmadı; GİB/İşNet canlı yetkisi ve nihai vergi kontrolleri bekleniyor." };
}
