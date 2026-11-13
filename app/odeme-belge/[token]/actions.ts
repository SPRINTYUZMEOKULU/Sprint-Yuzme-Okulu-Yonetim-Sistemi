"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { publicDocumentState } from "@/lib/payments/document-state";

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
  if (!request || publicDocumentState(request.status,request.expires_at)!=="form") return { ok: false, message: "Bu bağlantı geçersiz veya süresi dolmuş." };

  const recipientType = clean(formData.get("recipient_type"), 20);
  const recipientName = clean(formData.get("recipient_name"), 200);
  const taxIdentityNumber = clean(formData.get("tax_identity_number"), 20).replace(/\D/g, "");
  const taxOffice = clean(formData.get("tax_office"), 120);
  const address = clean(formData.get("address"), 500);
  const city = clean(formData.get("city"),100);
  const district = clean(formData.get("district"),100);
  const postalCode = clean(formData.get("postal_code"),10);
  const email = clean(formData.get("email"), 200);
  const phone = clean(formData.get("phone"), 30);
  const consent = formData.get("consent") === "on";

  if (!["individual", "company"].includes(recipientType) || !recipientName || !taxIdentityNumber || !address || !consent) return { ok: false, message: "Zorunlu belge bilgilerini ve onayı tamamlayınız." };
  if (recipientType === "individual" && taxIdentityNumber.length !== 11) return { ok: false, message: "T.C. Kimlik No 11 haneli olmalıdır." };
  if (recipientType === "company" && taxIdentityNumber.length !== 10) return { ok: false, message: "Vergi No 10 haneli olmalıdır." };
  if (recipientType === "company" && !taxOffice) return { ok: false, message: "Kurumsal belgede vergi dairesi zorunludur." };

  if(!city||!district)return {ok:false,message:"Belge alıcısının il ve ilçe bilgilerini tamamlayınız."};
  if(postalCode&&!/^\d{5}$/.test(postalCode))return {ok:false,message:"Posta kodu 5 haneli olmalıdır veya boş bırakılmalıdır."};
  if(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))return {ok:false,message:"Geçerli bir e-posta adresi yazınız veya alanı boş bırakınız."};
  const now = new Date().toISOString();
  const { data: saved, error } = await supabase.from("payment_document_requests").update({ recipient_type: recipientType, recipient_name: recipientName, tax_identity_number: taxIdentityNumber, tax_office: taxOffice || null, address, city, district, postal_code:postalCode||null, email: email || null, phone: phone || null, customer_consent_at: now, customer_completed_at: now, status: "waiting_payment", updated_at: now }).eq("id", request.id).eq("status", "waiting_customer").gt("expires_at", now).select("id").maybeSingle();
  if (error || !saved) return { ok: false, message: "Bilgiler kaydedilemedi. Lütfen tekrar deneyiniz." };
  revalidatePath(`/odeme-belge/${token}`);
  return { ok: true, message: "Bilgileriniz kaydedildi. Ödeme bilgilerine geçebilirsiniz." };
}
