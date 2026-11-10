"use server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contactNeedsFollowUp, TRIAL_STATUS } from "@/lib/registrations/follow-up";
const ROLES = ["owner", "admin", "branch_manager", "registration_staff"] as const;
function text(form: FormData, key: string, max = 1000) { return String(form.get(key) || "").trim().slice(0, max); }
export async function recordCandidateFollowUp(form: FormData) {
  const profile = await requireProfile([...ROLES]);
  const supabase = await createClient();
  const studentId = text(form, "student_id", 80);
  const { data: student, error } = await supabase.from("students").select("id,status").eq("organization_id", profile.organization_id).eq("id", studentId).single();
  if (error || !student || student.status !== "pre_registration") throw new Error("Bekleyen ön kayıt bulunamadı.");
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
    if (!TRIAL_STATUS[status]) throw new Error("Deneme durumu geçersiz.");
    const { data: previous, error: previousError } = await supabase.from("student_activity_logs").select("new_value").eq("organization_id", profile.organization_id).eq("student_id", studentId).eq("activity_type", "trial_lesson").order("performed_at",{ascending:false}).limit(1).maybeSingle();
    if (previousError) throw new Error("Deneme geçmişi okunamadı.");
    if (status !== "planned" && previous?.new_value?.status !== "planned") throw new Error("Önce bir deneme dersi planlayınız.");
    if (status === "planned") {
      const groupId = text(form,"group_id",80);
      const local = text(form,"scheduled_at",30);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("Deneme tarih ve saatini seçiniz.");
      const scheduledAt = new Date(`${local}:00+03:00`);
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) throw new Error("Gelecekte bir deneme tarihi seçiniz.");
      const {data:group, error:groupError} = await supabase.from("training_groups").select("id,name,branch_id,is_active").eq("organization_id",profile.organization_id).eq("id",groupId).single();
      if (groupError || !group || group.is_active === false) throw new Error("Aktif bir grup seçiniz.");
      value = {status, group_id:group.id, group_name:group.name, branch_id:group.branch_id, scheduled_at:scheduledAt.toISOString(), note};
    } else {
      if (note.length < 5) throw new Error("Deneme sonucunu en az 5 karakterle yazınız.");
      value = {...previous!.new_value, status, note};
    }
    title = `Deneme dersi · ${TRIAL_STATUS[status]}`;
  } else throw new Error("İşlem türü geçersiz.");
  const {error:writeError} = await supabase.from("student_activity_logs").insert({organization_id:profile.organization_id,student_id:studentId,activity_type:kind === "contact" ? "contact_request_resolved" : "trial_lesson",title,description:note || title,new_value:value,source_type:"pre_registration_center",source_id:studentId,performed_by:profile.id,performed_at:new Date().toISOString()});
  if (writeError) throw new Error("İşlem kaydedilemedi: " + writeError.message);
  revalidatePath("/on-kayitlar"); revalidatePath("/deneme-dersleri"); revalidatePath(`/kayit-tamamlama/${studentId}`); revalidatePath(`/ogrenciler/${studentId}`);
  redirect(`/kayit-tamamlama/${studentId}?follow_up_saved=1`);
}
