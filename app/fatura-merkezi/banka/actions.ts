"use server";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { revalidatePath } from "next/cache";
export async function startBankDocument(entryId:string,studentId:string,duplicateNote:string="") {
  const profile=await requireProfile(["owner","admin"]);
  if(!profile.organization_id)return {ok:false,message:"Kurum bilgisi eksik."};
  const {error}=await documentAdmin().rpc("link_invoice_bank_entry",{p_organization:profile.organization_id,p_entry:entryId,p_student:studentId,p_actor:profile.id,p_duplicate_note:duplicateNote.slice(0,500)});
  if(error)return {ok:false,message:"Talep oluşturulamadı. Benzer hareketleri ve kursiyer seçimini kontrol ediniz."};
  revalidatePath("/fatura-merkezi");revalidatePath("/fatura-merkezi/banka");revalidatePath("/odeme-bilgileri/belgeler");
  return {ok:true,message:"Ortak belge talebi oluşturuldu. Müşteri bilgileri tamamlandıktan sonra mevcut ödeme kaydıyla eşleştirilecek. Fatura kesilmedi."};
}
export async function excludeBankEntry(entryId:string,note:string) {
  const profile=await requireProfile(["owner","admin"]);
  if(!profile.organization_id||note.trim().length<5||note.length>500)return {ok:false,message:"En az 5 karakterlik bir kontrol gerekçesi yazınız."};
  const {data,error}=await documentAdmin().from("invoice_bank_entries").update({status:"excluded",review_note:note.trim(),reviewed_by:profile.id,reviewed_at:new Date().toISOString()}).eq("organization_id",profile.organization_id).eq("id",entryId).eq("status","review").is("document_request_id",null).select("id").maybeSingle();
  if(error||!data)return {ok:false,message:"Hareket değişmiş veya belge talebine bağlanmış. Sayfayı yenileyiniz."};
  revalidatePath("/fatura-merkezi/banka");revalidatePath("/fatura-merkezi");
  return {ok:true,message:"Hareket gerekçesiyle birlikte kapsam dışında bırakıldı; silinmedi."};
}
