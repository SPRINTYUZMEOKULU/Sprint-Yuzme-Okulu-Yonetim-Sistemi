"use server";

import { responseState, requestStatusLabels } from "@/lib/guardian/request-state";
import { linkGuardianStudentCanonical, unlinkGuardianStudentCanonical } from "./[id]/actions";
import { portalCredentialContact, savePortalCredential } from "./portal-credential-actions";
import { revalidateGuardianConnection } from "@/lib/guardian/revalidate";
import { getGuardianContext } from "@/lib/guardian/data";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";

const managementRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;
const staffRoles = ["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"] as const;

async function deliverRequestNotification(input:Parameters<typeof createNotification>[0]){
 try{return await createNotification(input);}catch(error){console.error("Veli görüşme bildirimi kaydedilemedi",error);return {ok:false};}
}
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function text(formData: FormData, key: string, max = 3000) {
  return String(formData.get(key) || "").trim().slice(0, max);
}

function back(path: string, key: "saved" | "error", message: string): never {
  redirect(`${path}${path.includes("?")?"&":"?"}${key}=${encodeURIComponent(message)}`);
}


function normalizePhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.length === 10 && digits.startsWith("5") ? `+90${digits}` : "";
}

async function ensureGuardianProfile(admin: ReturnType<typeof adminClient>, guardianId: string, organizationId: string) {
  const { data: existing, error: profileReadError } = await admin
    .from("profiles")
    .select("id,organization_id,role")
    .eq("id", guardianId)
    .maybeSingle();

  if (profileReadError) return { ok: false as const, message: profileReadError.message };

  if (existing) {
    if (existing.organization_id !== organizationId || existing.role !== "guardian") {
      return { ok: false as const, message: "Veli profili bu organizasyona ait değil veya veli rolünde değil." };
    }
    return { ok: true as const };
  }

  const { data: authResult, error: authError } = await admin.auth.admin.getUserById(guardianId);
  const authUser = authResult?.user;
  if (authError || !authUser) {
    return { ok: false as const, message: authError?.message || "Veli Auth hesabı bulunamadı." };
  }

  const metadata = authUser.user_metadata || {};
  if (metadata.role && metadata.role !== "guardian") {
    return { ok: false as const, message: "Auth hesabı veli rolünde değil." };
  }
  if (metadata.organization_id && metadata.organization_id !== organizationId) {
    return { ok: false as const, message: "Auth hesabı farklı bir organizasyona bağlı." };
  }

  const rawPhone = String(authUser.phone || "").replace(/\D/g, "");
  const { error: repairError } = await admin.from("profiles").upsert({
    id: guardianId,
    organization_id: organizationId,
    full_name: String(metadata.full_name || "Veli").trim().slice(0, 200),
    email: authUser.email || null,
    phone: rawPhone ? `+${rawPhone}` : null,
    role: "guardian",
    is_active: true,
    last_sign_in_at: authUser.last_sign_in_at || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (repairError) return { ok: false as const, message: `Veli profili onarılamadı: ${repairError.message}` };
  return { ok: true as const };
}

export async function prepareGuardianPortalAccess(guardianProfileId: string, password?: string) {
  return password === undefined
    ? portalCredentialContact({accountId:guardianProfileId})
    : savePortalCredential({accountId:guardianProfileId},password);
}

export async function updateGuardian(formData: FormData) {
  const actor=await requireProfile([...managementRoles]);const org=actor.organization_id;
  const guardianId=text(formData,"guardian_id",100),path=`/veliler/${guardianId}`;
  if(!org||!guardianId)back("/veliler","error","Veli bulunamadı.");
  const fullName=text(formData,"full_name",200),rawPhone=text(formData,"phone",40),phone=rawPhone?normalizePhone(rawPhone):null;
  if(!fullName || (rawPhone&&!phone))back(path,"error","Ad soyad ve geçerli bir cep telefonu girin.");
  const active=formData.get("is_active")==="on",db=adminClient();
  const [{data:current},{data:record},{data:auth,error:authError}]=await Promise.all([
    db.from("profiles").select("id,full_name,phone,is_active").eq("organization_id",org).eq("id",guardianId).eq("role","guardian").maybeSingle(),
    db.from("guardians").select("id,full_name,phone,is_active,login_enabled").eq("organization_id",org).eq("auth_user_id",guardianId).maybeSingle(),
    db.auth.admin.getUserById(guardianId),
  ]);
  if(!current||!record||authError||!auth.user)back(path,"error","Portal hesabının bağlantıları eksik. Önce hesap kaydını kontrol edin.");
  if(!phone && (current.phone||auth.user.phone))back(path,"error","Girişte kullanılan telefon silinemez. Yeni telefon numarasını girin.");
  const oldAuthPhone=normalizePhone(auth.user.phone),phoneChanged=Boolean(phone&&phone!==oldAuthPhone);
  if(phoneChanged){const {error}=await db.auth.admin.updateUserById(guardianId,{phone:phone!,phone_confirm:true});if(error)back(path,"error","Telefon giriş hesabına kaydedilemedi. Numara başka hesapta kullanılıyor olabilir.");}
  const stamp=new Date().toISOString();
  const {error:profileError}=await db.from("profiles").update({full_name:fullName,phone,is_active:active,updated_at:stamp}).eq("organization_id",org).eq("id",guardianId).eq("role","guardian");
  const recordResult=profileError?{error:profileError}:await db.from("guardians").update({full_name:fullName,phone,is_active:active,login_enabled:active,updated_at:stamp}).eq("organization_id",org).eq("id",record.id);
  if(recordResult.error){
    const profileRollback=await db.from("profiles").update({full_name:current.full_name,phone:current.phone,is_active:current.is_active,updated_at:stamp}).eq("organization_id",org).eq("id",guardianId).eq("role","guardian");
    const authRollback=phoneChanged?await db.auth.admin.updateUserById(guardianId,{phone:auth.user.phone||"",phone_confirm:true}):{error:null};
    back(path,"error",profileRollback.error||authRollback.error?"Kayıt tamamlanamadı; telefon eşleştirmesi kontrol edilmelidir.":"Kayıt tamamlanamadı. Önceki bilgiler korundu; tekrar deneyin.");
  }
  const {data:links}=await db.from("guardian_students").select("student_id").eq("guardian_id",record.id);
  for(const link of links||[])revalidateGuardianConnection(guardianId,link.student_id);
  revalidatePath("/veliler");revalidatePath(path);
  back(path,"saved","Veli bilgileri, giriş telefonu ve portal erişimi birlikte güncellendi.");
}

export async function linkGuardianStudent(formData: FormData) {
  formData.set("guardian_profile_id", text(formData, "guardian_id", 100));
  return linkGuardianStudentCanonical(formData);
}

export async function unlinkGuardianStudent(formData: FormData) {
  formData.set("guardian_profile_id", text(formData, "guardian_id", 100));
  return unlinkGuardianStudentCanonical(formData);
}

export async function createGuardianRequest(formData: FormData) {
  const profile = await requireProfile(["guardian"]);
  const organizationId = profile.organization_id;
  const studentId = text(formData, "student_id", 100);
  const subject = text(formData, "subject", 200);
  const requestPath = `/veli-talepleri${studentId?`?child=${encodeURIComponent(studentId)}`:""}`;
  const description = text(formData, "description", 4000);
  if (!organizationId || !studentId || !subject || !description) back(requestPath, "error", "Öğrenci, konu ve açıklama zorunludur.");

  const context = await getGuardianContext(profile.id, studentId);
  if (!context.students.some(student => student.id === studentId)) back(requestPath, "error", "Bu öğrenci için talep oluşturma yetkiniz yok.");

  const sourceNoteId = text(formData,"source_note_id",100) || null;
  if(sourceNoteId){const {data:note}=await adminClient().from("student_notes").select("id").eq("organization_id",organizationId).eq("student_id",studentId).eq("id",sourceNoteId).eq("is_guardian_visible",true).maybeSingle();if(!note)back(requestPath,"error","Paylaşılan not bulunamadı.");}
  const requestNumber = `VTL-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`;
  const { data: created, error } = await adminClient().from("guardian_requests").insert({
    organization_id: organizationId,
    guardian_id: profile.id,
    student_id: studentId,
    request_number: requestNumber,
    source_note_id: sourceNoteId,
    category: text(formData, "category", 50) || "other",
    subject,
    description,
    priority: text(formData, "priority", 20) || "normal",
    status: "new",
  }).select("id").single();
  if (error) back(requestPath, "error", error.message);

  const delivery=await deliverRequestNotification({
    organizationId,
    category: "students",
    eventKey: "guardian_request_created",
    notificationType: "guardian_request_created",
    title: `Yeni veli talebi · ${requestNumber}`,
    body: `${profile.full_name || "Veli"}: ${subject}`,
    severity: text(formData, "priority", 20) === "urgent" ? "critical" : "info",
    priority: text(formData, "priority", 20) === "urgent" ? "critical" : "normal",
    studentId,
    sourceType: "guardian_request",
    sourceId: created?.id || null,
    targetPath: `/veli-talepleri?request=${created?.id || ""}`,
    push: true,
  });

  revalidateGuardianConnection(profile.id,studentId);
  back(requestPath, "saved", `Talebiniz oluşturuldu. Talep numarası: ${requestNumber}${delivery.ok?"":" · Yönetim bildirimi oluşturulamadı; talep kaydınız korunuyor."}`);
}

export async function manageGuardianRequest(formData: FormData) {
  const profile = await requireProfile([...staffRoles]);
  const organizationId = profile.organization_id;
  const requestId = text(formData, "request_id", 100);
  if (!organizationId || !requestId) back("/veli-talepleri", "error", "Talep bulunamadı.");

  const supabase = adminClient();
  const {data:previous,error:readError}=await supabase.from("guardian_requests").select("*").eq("organization_id",organizationId).eq("id",requestId).maybeSingle();
  if(readError||!previous)back("/veli-talepleri","error","Talep bulunamadı.");
  const requestedStatus = text(formData, "status", 30) || "reviewing";
  if(!requestStatusLabels[requestedStatus])back("/veli-talepleri","error","Geçersiz talep durumu.");
  const assignedTo=text(formData,"assigned_to",100)||null;
  if(assignedTo){const {data:assignee}=await supabase.from("profiles").select("id").eq("organization_id",organizationId).eq("id",assignedTo).eq("is_active",true).in("role",[...staffRoles]).maybeSingle();if(!assignee)back("/veli-talepleri","error","Atanacak personel bulunamadı.");}
  const guardianResponse = text(formData, "guardian_response", 4000) || previous.guardian_response || null;
  if(formData.get("expected_updated_at") && text(formData,"expected_updated_at",100)!==previous.updated_at)back("/veli-talepleri","error","Görüşmeye yeni yanıt geldi. Güncel kaydı açıp tekrar deneyin.");
  const state=responseState(requestedStatus,guardianResponse,previous.guardian_response);
  const status=state.status;
  const { data: requestRow, error } = await supabase.from("guardian_requests").update({
    status,
    priority: text(formData, "priority", 20) || "normal",
    assigned_to: assignedTo,
    internal_note: text(formData, "internal_note", 4000) || null,
    guardian_response: guardianResponse,
    responded_by: state.changed ? profile.id : previous.responded_by,
    responded_at: state.changed ? new Date().toISOString() : previous.responded_at,
    resolved_at: status === "resolved" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("organization_id", organizationId).eq("id", requestId).eq("updated_at",previous.updated_at)
    .select("guardian_id,student_id,request_number").single();
  if (error) back("/veli-talepleri", "error", error.message);

  let notificationOk=true;
  if (state.changed && guardianResponse && requestRow?.guardian_id) {
    const delivery=await deliverRequestNotification({
      organizationId,
      category: "students",
      eventKey: "guardian_request_answered",
      notificationType: "guardian_request_answered",
      title: `Talebiniz yanıtlandı · ${requestRow.request_number}`,
      body: guardianResponse,
      severity: "success",
      priority: "normal",
      studentId: requestRow.student_id,
      sourceType: "guardian_request",
      sourceId: requestId,
      targetPath: `/veli-talepleri?child=${requestRow.student_id || ""}&request=${requestId}#talep-${requestId}`,
      recipientProfileIds: [requestRow.guardian_id],
      push: true,
    });
    notificationOk=delivery.ok;
  }

  if(requestRow?.student_id)revalidateGuardianConnection(requestRow.guardian_id,requestRow.student_id);
  revalidatePath("/veli-talepleri");
  back("/veli-talepleri", "saved", notificationOk?"Talep ve görüşme geçmişi güncellendi.":"Yanıt kaydedildi; veli bildirimi oluşturulamadı.");
}

export async function replyGuardianRequest(formData:FormData){
 const profile=await requireProfile(["guardian"]),org=profile.organization_id;
 const id=text(formData,"request_id",100),body=text(formData,"body",4000);
 const db=adminClient();
 const {data:row}=await db.from("guardian_requests").select("id,student_id,request_number").eq("organization_id",org).eq("guardian_id",profile.id).eq("id",id).maybeSingle();
 const path=`/veli-talepleri?child=${row?.student_id||""}&request=${id}`;
 if(!org||!row||!body)back(path,"error","Talep ve yanıt bilgisi eksik.");
 const context=await getGuardianContext(profile.id,row.student_id);
 if(!context.students.some(s=>s.id===row.student_id))back(path,"error","Bu kursiyere erişiminiz yok.");
 const {data:replyId,error}=await db.rpc("reply_guardian_request",{p_request:id,p_org:org,p_author:profile.id,p_body:body});
 if(error)back(path,"error","Yanıt kaydedilemedi. Talep arşivlenmiş veya erişiminiz değişmiş olabilir.");
 const delivery=await deliverRequestNotification({organizationId:org,category:"students",eventKey:"guardian_request_reply",title:`Veliden yeni yanıt · ${row.request_number}`,body,studentId:row.student_id,sourceType:"guardian_request_reply",sourceId:replyId,targetPath:`/veli-talepleri?request=${id}#talep-${id}`,createdBy:profile.id,push:true});
 revalidateGuardianConnection(profile.id,row.student_id);
 back(path,"saved",delivery.ok?"Yanıtınız yönetime iletildi.":"Yanıt kaydedildi; yönetim bildirimi oluşturulamadı.");
}
