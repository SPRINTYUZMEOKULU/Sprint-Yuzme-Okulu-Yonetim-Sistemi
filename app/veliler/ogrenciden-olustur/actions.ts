"use server";

import { activePortalStudentIds } from "@/lib/guardian/portal-student-eligibility";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizePortalPhone, resolvePortalRecipient } from "@/lib/guardian/portal-recipient";
import { requireProfile } from "@/lib/auth/profile";

const roles = ["owner", "admin", "branch_manager", "registration_staff"] as const;
function adminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function phoneCandidates(phone:string){const local=phone.replace(/^\+90/,"");return[phone,`90${local}`,`0${local}`,local]}
function safeMessage(value:string){return encodeURIComponent(value.slice(0,260))}

export async function createOrLinkGuardianFromStudent(formData:FormData){
 const profile=await requireProfile([...roles]);const organizationId=profile.organization_id;const studentId=String(formData.get("student_id")||"").trim();
 if(!organizationId||!studentId)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Öğrenci bulunamadı.")}`);
 const admin=adminClient();
 const {data:student,error:studentError}=await admin.from("students").select("id,first_name,last_name,phone,guardian_name,guardian_phone,guardian_email,preferred_group_id").eq("id",studentId).eq("organization_id",organizationId).eq("is_deleted",false).maybeSingle();
 if(studentError||!student)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(studentError?.message||"Öğrenci bulunamadı.")}`);
 const activeIds = await activePortalStudentIds(admin, organizationId, [studentId]).catch(() => new Set<string>());
 if (!activeIds.has(studentId)) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Portal hesabı için kursiyerin aktiflik durumu doğrulanmalıdır.")}`);
 let group:any=null;
 if(student.preferred_group_id){const {data:groupData}=await admin.from("training_groups").select("id,name,course_type").eq("id",student.preferred_group_id).eq("organization_id",organizationId).maybeSingle();group=groupData}
 const {fullName:accountName,phone:accountPhone,email:accountEmail,relationship,error:recipientError}=resolvePortalRecipient(student,group);
 const useSelf=relationship==="Kendisi";
 if(recipientError)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(recipientError)}&student=${studentId}`);
 const {data:existingLinks,error:existingLinksError}=await admin.from("guardian_students").select("guardian_id,is_primary").eq("student_id",studentId).order("is_primary",{ascending:false});
 if(existingLinksError)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Mevcut veli bağlantıları okunamadı.")}&student=${studentId}`);
 let pendingGuardian:any=null;
 for(const link of existingLinks||[]){
  const {data:g,error}=await admin.from("guardians").select("id,auth_user_id,phone,is_active,login_enabled").eq("id",link.guardian_id).eq("organization_id",organizationId).maybeSingle();
  if(error||!g)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Öğrencide geçersiz/eski bir portal bağlantısı bulundu.")}&student=${studentId}`);
  if(g.auth_user_id)redirect(`/veliler/ogrenciden-olustur?saved=${safeMessage("Öğrenci zaten bir portal hesabına bağlı. Giriş durumu ve şifre işlemlerini veli merkezinden kontrol edin.")}&guardian=${g.auth_user_id}&student=${studentId}`);
  if(g.is_active===false||g.login_enabled===false)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Veli erişimi pasif. Önce veli merkezinden erişimi kontrol edin.")}&student=${studentId}`);
  if(pendingGuardian&&pendingGuardian.id!==g.id)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Birden fazla tamamlanmamış veli bağlantısı var. Veli merkezinden birincil bağlantıyı kontrol edin.")}&student=${studentId}`);
  if(normalizePortalPhone(g.phone)&&normalizePortalPhone(g.phone)!==accountPhone)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Bağlı veli ile öğrenci dosyasındaki telefonlar farklı. Önce iletişim bilgilerini kontrol edin.")}&student=${studentId}`);
  pendingGuardian=g;
 }
 let profileGuardian:any=null;const candidates=phoneCandidates(accountPhone);const {data:byPhone,error:phoneLookupError}=await admin.from("profiles").select("id,full_name,email,phone,role,is_active").eq("organization_id",organizationId).eq("role","guardian").in("phone",candidates).limit(1).maybeSingle();if(phoneLookupError)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(phoneLookupError.message)}&student=${studentId}`);profileGuardian=byPhone;
 if(!profileGuardian&&accountEmail){const {data:byEmail}=await admin.from("profiles").select("id,full_name,email,phone,role,is_active").eq("organization_id",organizationId).eq("role","guardian").eq("email",accountEmail).limit(1).maybeSingle();profileGuardian=byEmail}
 let authUserId=profileGuardian?.id||"",created=false;
 if(authUserId){const {data:authData,error:authLookupError}=await admin.auth.admin.getUserById(authUserId);if(authLookupError||!authData.user)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Mevcut portal hesabının kimlik kaydı bulunamadı.")}&student=${studentId}`);if(authData.user.phone!==accountPhone){const {error}=await admin.auth.admin.updateUserById(authUserId,{phone:accountPhone,user_metadata:{...(authData.user.user_metadata||{}),full_name:accountName,role:"guardian",organization_id:organizationId}});if(error)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Telefon Auth hesabına bağlanamadı: ${error.message}`)}&student=${studentId}`)}await admin.from("profiles").update({phone:accountPhone,full_name:profileGuardian.full_name||accountName,email:profileGuardian.email||accountEmail||null,is_active:true,updated_at:new Date().toISOString()}).eq("id",authUserId).eq("organization_id",organizationId)}
 else{const {data:createdUser,error:createError}=await admin.auth.admin.createUser({phone:accountPhone,password:`Sprint-${crypto.randomUUID()}-A9!`,user_metadata:{full_name:accountName,role:"guardian",organization_id:organizationId}});if(createError||!createdUser.user)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(createError?.message||"Portal hesabı oluşturulamadı.")}&student=${studentId}`);authUserId=createdUser.user.id;created=true;const {error}=await admin.from("profiles").upsert({id:authUserId,organization_id:organizationId,full_name:accountName,phone:accountPhone,email:accountEmail||null,role:"guardian",is_active:true,last_sign_in_at:null,updated_at:new Date().toISOString()},{onConflict:"id"});if(error){await admin.auth.admin.deleteUser(authUserId);redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Portal profili oluşturulamadı: ${error.message}`)}&student=${studentId}`)}}
 // guardian_students.guardian_id -> public.guardians.id (NOT profiles/auth.users.id).
 let guardianRecord:any=pendingGuardian;const {data:byAuth}=await admin.from("guardians").select("id,auth_user_id").eq("organization_id",organizationId).eq("auth_user_id",authUserId).limit(1).maybeSingle();if(byAuth&&pendingGuardian&&byAuth.id!==pendingGuardian.id)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Mevcut giriş hesabı başka bir veli kaydına bağlı. Veli merkezinden kontrol edin.")}&student=${studentId}`);guardianRecord=byAuth||pendingGuardian;
 if(!guardianRecord){const {data:byGuardianPhone}=await admin.from("guardians").select("id,auth_user_id").eq("organization_id",organizationId).in("phone",candidates).limit(1).maybeSingle();guardianRecord=byGuardianPhone;}
 if(guardianRecord?.auth_user_id&&guardianRecord.auth_user_id!==authUserId)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Telefon başka bir portal hesabına bağlı. Veli merkezinden kontrol edin.")}&student=${studentId}`);
 if(guardianRecord&&!guardianRecord.auth_user_id){const {error}=await admin.from("guardians").update({auth_user_id:authUserId,login_enabled:true,is_active:true,full_name:accountName,phone:accountPhone,email:accountEmail||null,relationship,first_login_required:true,portal_created_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",guardianRecord.id).eq("organization_id",organizationId);if(error)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Veli giriş bağlantısı kaydedilemedi. İşlem tamamlanmadı.")}&student=${studentId}`);}
 if(!guardianRecord){const {data:newGuardian,error:gError}=await admin.from("guardians").insert({organization_id:organizationId,full_name:accountName,phone:accountPhone,email:accountEmail||null,relationship,auth_user_id:authUserId,login_enabled:true,is_active:true,first_login_required:true,portal_created_at:new Date().toISOString()}).select("id,auth_user_id").single();if(gError||!newGuardian){if(created)await admin.auth.admin.deleteUser(authUserId);redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Portal kişi kaydı oluşturulamadı: ${gError?.message||"Bilinmeyen hata"}`)}&student=${studentId}`)}guardianRecord=newGuardian}
 const {error:primaryError}=await admin.from("guardian_students").update({is_primary:false}).eq("student_id",studentId).eq("is_primary",true).neq("guardian_id",guardianRecord.id);
 if(primaryError)redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Birincil veli bağlantısı güncellenemedi.")}&student=${studentId}`);
 const {error:linkError}=await admin.from("guardian_students").upsert({guardian_id:guardianRecord.id,student_id:studentId,relationship,is_primary:true,is_payment_contact:true,receives_messages:true,portal_access:true},{onConflict:"guardian_id,student_id"});
 if(linkError){redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Portal hesabı öğrenciye bağlanamadı: ${linkError.message}`)}&student=${studentId}`)}
 try{await admin.from("student_activity_logs").insert({organization_id:organizationId,student_id:studentId,activity_type:useSelf?"student_self_portal_created":"guardian_portal_created_from_student",title:created?(useSelf?"Kursiyer portal hesabı oluşturuldu":"Veli portal hesabı oluşturuldu"):useSelf?"Mevcut kursiyer portal hesabı bağlandı":"Mevcut veli portal hesabı bağlandı",description:`${accountName} portal hesabına ${relationship} olarak bağlandı.`,source_type:"guardian_creation_wizard",source_id:authUserId,performed_at:new Date().toISOString()})}catch{}
 revalidatePath("/veliler");revalidatePath("/veliler/ogrenciden-olustur");revalidatePath(`/ogrenciler/${studentId}`);revalidatePath(`/veliler/${authUserId}`);
 const saved=created?(useSelf?"Kursiyerin kendi portal hesabı oluşturuldu ve kursiyer kaydına bağlandı. Telefon doğrulaması için hazır.":"Veli hesabı oluşturuldu ve öğrenciye bağlandı. Telefon doğrulaması için hazır."):(useSelf?"Kursiyerin mevcut portal hesabı bulundu ve kursiyer kaydına bağlandı.":"Mevcut veli hesabı bulundu ve öğrenciye bağlandı.");redirect(`/veliler/ogrenciden-olustur?saved=${safeMessage(saved)}&guardian=${authUserId}&student=${studentId}`)
}
