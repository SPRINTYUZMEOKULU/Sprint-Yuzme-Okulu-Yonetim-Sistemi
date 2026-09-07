"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";

function adminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function safe(v:string){return encodeURIComponent(v.slice(0,260))}
function phoneCandidates(value:string){let digits=String(value||"").replace(/\D/g,"");if(digits.startsWith("90")&&digits.length===12)digits=digits.slice(2);if(digits.startsWith("0")&&digits.length===11)digits=digits.slice(1);if(digits.length!==10)return[];return [`+90${digits}`,`90${digits}`,`0${digits}`,digits]}

export async function deleteGuardianPortalAccount(formData:FormData){
 const actor=await requireProfile(["owner","admin"]);
 const organizationId=actor.organization_id;
 const profileId=String(formData.get("guardian_profile_id")||"").trim();
 if(!organizationId||!profileId)redirect(`/veliler?error=${safe("Silinecek portal hesabı bulunamadı.")}`);
 const admin=adminClient();
 const {data:portalProfile,error:profileError}=await admin.from("profiles").select("id,full_name,phone,role,organization_id").eq("id",profileId).eq("organization_id",organizationId).eq("role","guardian").maybeSingle();
 if(profileError||!portalProfile)redirect(`/veliler?error=${safe(profileError?.message||"Portal hesabı bulunamadı.")}`);

 let guardianIds:string[]=[];
 const {data:byAuth}=await admin.from("guardians").select("id").eq("organization_id",organizationId).eq("auth_user_id",profileId);
 guardianIds=(byAuth||[]).map((x:any)=>x.id);
 if(!guardianIds.length&&portalProfile.phone){const candidates=phoneCandidates(portalProfile.phone);if(candidates.length){const {data:byPhone}=await admin.from("guardians").select("id").eq("organization_id",organizationId).in("phone",candidates);guardianIds=(byPhone||[]).map((x:any)=>x.id)}}

 if(guardianIds.length){
  const {error:guardianDeleteError}=await admin.from("guardians").delete().in("id",guardianIds).eq("organization_id",organizationId);
  if(guardianDeleteError)redirect(`/veliler?error=${safe(`Portal bağlantıları silinemedi: ${guardianDeleteError.message}`)}`);
 }

 const {error:authDeleteError}=await admin.auth.admin.deleteUser(profileId);
 if(authDeleteError){
  const {error:profileDeleteError}=await admin.from("profiles").delete().eq("id",profileId).eq("organization_id",organizationId).eq("role","guardian");
  if(profileDeleteError)redirect(`/veliler?error=${safe(`Hesap silinemedi: ${authDeleteError.message}`)}`);
 }

 revalidatePath("/veliler");
 revalidatePath("/veliler/ogrenciden-olustur");
 redirect(`/veliler?saved=${safe(`${portalProfile.full_name||"Portal hesabı"} silindi. Öğrenci kayıtları korunmuştur.`)}`);
}
