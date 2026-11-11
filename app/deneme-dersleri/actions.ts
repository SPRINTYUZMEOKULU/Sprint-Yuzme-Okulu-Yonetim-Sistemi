"use server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { trialEligibilityError, TRIAL_POLICY_VERSION } from "@/lib/registrations/trial-policy";
import { assertTrialAvailable } from "@/lib/registrations/trial-availability";
import { normalizeCourseType } from "@/lib/registrations/course-type";
import { contactNeedsFollowUp, TRIAL_STATUS } from "@/lib/registrations/follow-up";
const ROLES = ["owner", "admin", "branch_manager", "registration_staff"] as const;
function text(form: FormData, key: string, max = 1000) { return String(form.get(key) || "").trim().slice(0, max); }
export async function recordCandidateFollowUp(form: FormData) {
  const profile = await requireProfile([...ROLES]);
  const supabase = await createClient();
  const studentId = text(form, "student_id", 80);
  const { data: student, error } = await supabase.from("students").select("id,status,first_name,last_name,birth_date").eq("organization_id", profile.organization_id).eq("id", studentId).single();
  if (error || !student || student.status !== "pre_registration") throw new Error("Bekleyen ön kayıt bulunamadı.");
  function fail(message:string):never { redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(message)}`); }
  const kind = text(form, "kind", 30);
  let value: Record<string, unknown>;
  let title: string;
  const note = text(form, "note");
  if (kind === "contact") {
    const {data: consent, error: consentError} = await supabase.from("registration_consents").select("contact_request,accepted_at").eq("organization_id", profile.organization_id).eq("student_id", studentId).order("accepted_at", {ascending:false}).limit(1).maybeSingle();
    if (consentError || !contactNeedsFollowUp(consent?.contact_request)) throw new Error("İletişim talebi doğrulanamadı.");
    if (note.length < 5) throw new Error("Görüşme sonucunu en az 5 karakterle yazınız.");
    value = {contact_request:consent!.contact_request, consent_accepted_at:consent!.accepted_at, resolution:note};
    title = "İletişim talebi karşılandı";
  } else if (kind === "trial") {
    const status = text(form, "trial_status", 30);
    if (!TRIAL_STATUS[status]) fail("Deneme durumu geçersiz.");
    const { data: previous, error: previousError } = await supabase.from("student_activity_logs").select("new_value").eq("organization_id", profile.organization_id).eq("student_id", studentId).eq("activity_type", "trial_lesson").order("performed_at",{ascending:false}).limit(1).maybeSingle();
    if (previousError) fail("Deneme geçmişi okunamadı.");
    if (status !== "planned" && previous?.new_value?.status !== "planned") fail("Önce bir deneme dersi planlayınız.");
    if (status === "planned") {
      const {data:consent,error:consentError}=await supabase.from("registration_consents").select("registration_for").eq("organization_id",profile.organization_id).eq("student_id",studentId).order("accepted_at",{ascending:false}).limit(1).maybeSingle();
      if(consentError)fail("Kayıt türü doğrulanamadı.");
      const eligibility=trialEligibilityError(consent?.registration_for || "child",student.birth_date);
      if(eligibility)fail(eligibility);
      if(form.get("trial_approval_confirmed") !== "on")fail("Deneme dersini SPRİNT YÜZME OKULU adına açıkça onaylayınız.");
      try {await assertTrialAvailable(supabase,profile.organization_id!,student);} catch(error) {fail(error instanceof Error?error.message:"Deneme hakkı kontrol edilemedi.");}

      const groupId = text(form,"group_id",80);
      const local = text(form,"scheduled_at",30);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) fail("Deneme tarih ve saatini seçiniz.");
      const scheduledAt = new Date(`${local}:00+03:00`);
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) fail("Gelecekte bir deneme tarihi seçiniz.");
      const lessonEligibility=trialEligibilityError(consent?.registration_for || "child",student.birth_date,local.slice(0,10));
      if(lessonEligibility)fail("Deneme tarihinde çocuk 6 yaş veya altında olmalıdır.");
      const {data:group, error:groupError} = await supabase.from("training_groups").select("id,name,branch_id,is_active,course_type").eq("organization_id",profile.organization_id).eq("id",groupId).single();
      if (groupError || !group || group.is_active === false) fail("Aktif bir grup seçiniz.");
      if(normalizeCourseType(group.course_type) === "adult")fail("Yetişkin grubuna deneme dersi onaylanamaz.");
      value = {approved_at:new Date().toISOString(),approved_by:profile.id,policy_version:TRIAL_POLICY_VERSION,status, group_id:group.id, group_name:group.name, branch_id:group.branch_id, scheduled_at:scheduledAt.toISOString(), note};
    } else {
      if (note.length < 5) throw new Error("Deneme sonucunu en az 5 karakterle yazınız.");
      value = {...previous!.new_value, status, note};
    }
    title = status === "planned" ? "Deneme dersi okul tarafından onaylandı" : `Deneme dersi · ${TRIAL_STATUS[status]}`;
  } else throw new Error("İşlem türü geçersiz.");
  const {error:writeError} = await supabase.from("student_activity_logs").insert({organization_id:profile.organization_id,student_id:studentId,activity_type:kind === "contact" ? "contact_request_resolved" : "trial_lesson",title,description:note || title,new_value:value,source_type:"pre_registration_center",source_id:studentId,performed_by:profile.id,performed_at:new Date().toISOString()});
  if (writeError) throw new Error("İşlem kaydedilemedi: " + writeError.message);
  revalidatePath("/on-kayitlar"); revalidatePath("/deneme-dersleri"); revalidatePath(`/kayit-tamamlama/${studentId}`); revalidatePath(`/ogrenciler/${studentId}`);
  redirect(`/kayit-tamamlama/${studentId}?follow_up_saved=1`);
}

export async function approvedTrialMessage(studentId: string) {
  const profile=await requireProfile([...ROLES]);
  const supabase=await createClient();
  const [{data:student,error:studentError},{data:trial,error:trialError}]=await Promise.all([
    supabase.from("students").select("id,first_name,last_name,guardian_phone,phone").eq("organization_id",profile.organization_id).eq("id",studentId).maybeSingle(),
    supabase.from("student_activity_logs").select("id,new_value").eq("organization_id",profile.organization_id).eq("student_id",studentId).eq("activity_type","trial_lesson").order("performed_at",{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(studentError || trialError || !student || !trial?.new_value?.approved_at || trial.new_value.status !== "planned") return {ok:false as const,message:"Bilgilendirme yalnızca okul tarafından onaylanmış, planlanan deneme dersi için hazırlanabilir."};
  let phone=String(student.guardian_phone || student.phone || "").replace(/\D/g,"");
  if(phone.startsWith("0"))phone=`90${phone.slice(1)}`;
  if(phone.length===10)phone=`90${phone}`;
  if(!/^90\d{10}$/.test(phone))return {ok:false as const,message:"Veli telefonunu kontrol edip tamamlayınız."};
  const {createHash}=await import("node:crypto");
  const digest=createHash("sha256").update(`${profile.organization_id}|${studentId}|${trial.id}`).digest("hex").slice(0,32);
  const messageId=`${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20)}`;
  const {data:log,error:logError}=await supabase.from("message_logs").select("status").eq("organization_id",profile.organization_id).eq("student_id",studentId).eq("id",messageId).maybeSingle();
  if(logError)return {ok:false as const,message:"Bilgilendirme geçmişi okunamadı."};
  const {formatDisplayDateTime}=await import("@/lib/dates/display");
  const message=`*SPRİNT YÜZME OKULU*\n\nSayın Velimiz,\n\n${student.first_name} ${student.last_name} için deneme dersi başvurunuz okulumuz tarafından *onaylanmıştır*.\n\nGrup: ${trial.new_value.group_name}\nTarih ve saat: ${formatDisplayDateTime(new Date(trial.new_value.scheduled_at))}\n\nDeneme dersi kişi başına bir kez uygulanır. Katılımınızla ilgili değişiklik varsa lütfen bize bildiriniz.\n\nBilgilendirme Hattı: 0551 896 83 19`;
  return {ok:true as const,studentId,interactionId:trial.id,recipient:phone,message,sent:log?.status === "sent",opened:log?.status === "opened"};
}
