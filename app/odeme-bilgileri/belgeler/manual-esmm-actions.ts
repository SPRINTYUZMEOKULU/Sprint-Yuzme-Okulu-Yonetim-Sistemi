"use server";

import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { revalidatePath } from "next/cache";

export async function recordPortalEsmm(requestId:string, documentNumber:string, ettn:string, issueDate:string, total:string) {
 const profile = await requireProfile(["owner","admin"]);
 if(!profile.organization_id) return {ok:false,message:"Kurum bulunamadı."};
 const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(requestId)||!uuid.test(ettn)||!/^[A-Z0-9]{10,32}$/.test(documentNumber)||
   !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)||!/^\d{1,10}(?:\.\d{1,2})?$/.test(total))
   return {ok:false,message:"Makbuz numarası, ETTN, tarih veya TL tutarı biçimi hatalı."};
 const db = documentAdmin();
 const {data,error}=await db.rpc("record_manual_esmm_reference",{
   p_organization_id:profile.organization_id,p_request_id:requestId,p_actor_id:profile.id,
   p_number:documentNumber,p_ettn:ettn,p_issue_date:issueDate,p_total:Number(total)
 });
 if(error) return {ok:false,message:"Portal makbuzu kayıt kontrolü tamamlanamadı; değişiklik yapılmadı."};
 const row=Array.isArray(data)?data[0]:null;
 if(!row?.ok){
   const descriptions:Record<string,string>={
     unauthorized:"Yönetici yetkisi yok.",invalid_document:"Belge alanları geçersiz.",
     not_found:"Talep bulunamadı.",request_not_ready:"Müşteri bilgisi, e-SMM türü veya ödeme aşaması eksik.",
     payment_mismatch:"Kesinleşmiş tahsilat ile makbuz toplamı uyuşmuyor.",
     potential_duplicate:"Bu talep, tahsilat, ETTN veya makbuz numarası daha önce kullanılmış olabilir."
   };
   return {ok:false,message:descriptions[row?.result_code]||"Belge doğrulaması başarısız."};
 }
 revalidatePath("/odeme-bilgileri/belgeler");
 revalidatePath("/fatura-merkezi");
 return {ok:true,message:"Portalda önceden kesilmiş e-SMM referansı kaydedildi; belge hâlâ doğrulama bekliyor. Yeni e-SMM kesilmedi veya veliye gönderilmedi."};
}
