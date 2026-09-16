"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Sistem bağlantısı yapılandırılmamış.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clean(v: FormDataEntryValue | null, max = 300) {
  return String(v || "").trim().slice(0, max);
}

export async function saveCustomerDocumentInfo(token: string, formData: FormData) {
  const supabase = admin();
  const { data: request } = await supabase.from("payment_document_requests").select("id,expires_at,status").eq("public_token", token).maybeSingle();
  if (!request || new Date(request.expires_at).getTime() < Date.now() || request.status === "cancelled") return { ok: false, message: "Bu bağlantı geçersiz veya süresi dolmuş." };

  const recipientType = clean(formData.get("recipient_type"), 20);
  const recipientName = clean(formData.get("recipient_name"), 200);
  const taxIdentityNumber = clean(formData.get("tax_identity_number"), 20).replace(/\D/g, "");
  const taxOffice = clean(formData.get("tax_office"), 120);
  const address = clean(formData.get("address"), 500);
  const email = clean(formData.get("email"), 200);
  const phone = clean(formData.get("phone"), 30);
  const consent = formData.get("consent") === "on";

  if (!["individual", "company"].includes(recipientType) || !recipientName || !taxIdentityNumber || !address || !consent) return { ok: false, message: "Zorunlu belge bilgilerini ve onayı tamamlayınız." };
  if (recipientType === "individual" && taxIdentityNumber.length !== 11) return { ok: false, message: "T.C. Kimlik No 11 haneli olmalıdır." };
  if (recipientType === "company" && taxIdentityNumber.length !== 10) return { ok: false, message: "Vergi No 10 haneli olmalıdır." };
  if (recipientType === "company" && !taxOffice) return { ok: false, message: "Kurumsal belgede vergi dairesi zorunludur." };

  const now = new Date().toISOString();
  const { error } = await supabase.from("payment_document_requests").update({ recipient_type: recipientType, recipient_name: recipientName, tax_identity_number: taxIdentityNumber, tax_office: taxOffice || null, address, email: email || null, phone: phone || null, customer_consent_at: now, customer_completed_at: now, status: "waiting_payment", updated_at: now }).eq("id", request.id);
  if (error) return { ok: false, message: "Bilgiler kaydedilemedi. Lütfen tekrar deneyiniz." };
  revalidatePath(`/odeme-belge/${token}`);
  return { ok: true, message: "Bilgileriniz kaydedildi. Ödeme bilgilerine geçebilirsiniz." };
}
