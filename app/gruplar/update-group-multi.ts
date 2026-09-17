"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const COURSE_TYPES = ["Çocuk Yüzme Kursu", "Yetişkin Yüzme Kursu", "Özel Ders", "Takım / Performans"];
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const clean = (v: FormDataEntryValue | null, max = 200) => String(v || "").trim().slice(0, max);
const time = (v: FormDataEntryValue | null) => clean(v, 5);

function automaticName(branchName: string, weekdays: number[], startTime: string, courseType: string) {
  const dayText = [...weekdays].sort((a, b) => a - b).map((d) => DAYS[d]).filter(Boolean).join("-");
  const typeText = courseType === "Çocuk Yüzme Kursu" ? "Çocuk" : courseType === "Yetişkin Yüzme Kursu" ? "Yetişkin" : courseType === "Takım / Performans" ? "Takım" : courseType;
  return [branchName, dayText, startTime, typeText].filter(Boolean).join(" · ");
}

function refresh() {
  const paths = ["/gruplar", "/on-kayit", "/on-kayitlar", "/kayit-tamamlama", "/yoklama", "/ders-programi", "/operasyon-plani", "/ogrenciler"];
  paths.forEach((path) => revalidatePath(path));
}

export async function updateGroupMulti(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const organizationId = profile.organization_id;
  if (!organizationId) throw new Error("Kurum bilgisi bulunamadı.");
  const supabase = await createClient();

  const groupId = clean(formData.get("group_id"), 80);
  const branchId = clean(formData.get("branch_id"), 80);
  const levelId = clean(formData.get("level_id"), 80) || null;
  const coachId = clean(formData.get("primary_coach_id"), 80) || null;
  const capacity = Math.min(50, Math.max(1, Number(formData.get("capacity") || 6)));
  const description = clean(formData.get("description"), 500) || null;
  const startTime = time(formData.get("start_time"));
  const endTime = time(formData.get("end_time"));
  const publicRegistration = formData.get("public_registration") === "on";
  const weekdays = Array.from(new Set(formData.getAll("weekdays").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b);
  const courseTypes = Array.from(new Set(formData.getAll("course_types").map((v) => clean(v, 60)).filter((v) => COURSE_TYPES.includes(v))));

  if (!groupId || !branchId) throw new Error("Grup veya şube bilgisi eksik.");
  if (!courseTypes.length) throw new Error("En az bir kurs programı seçmelisiniz.");
  if (!weekdays.length) throw new Error("En az bir ders günü seçmelisiniz.");
  if (!startTime || !endTime || endTime <= startTime) throw new Error("Ders saatlerini kontrol edin.");

  const { data: existing, error: existingError } = await supabase.from("training_groups").select("id,course_type").eq("id", groupId).eq("organization_id", organizationId).maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Düzenlenecek grup bulunamadı.");
  if (!courseTypes.includes(existing.course_type)) throw new Error("Mevcut grup programı kaldırılamaz; grup geçmişini korumak için seçili bırakılmalıdır.");

  const { data: branch, error: branchError } = await supabase.from("branches").select("id,name").eq("id", branchId).eq("organization_id", organizationId).eq("is_active", true).maybeSingle();
  if (branchError) throw branchError;
  if (!branch) throw new Error("Şube bulunamadı veya aktif değil.");

  if (coachId) {
    const { data: coach } = await supabase.from("profiles").select("id").eq("id", coachId).eq("organization_id", organizationId).eq("role", "coach").eq("is_active", true).maybeSingle();
    if (!coach) throw new Error("Seçilen eğitmen bulunamadı veya aktif değil.");
  }

  const currentName = automaticName(branch.name, weekdays, startTime, existing.course_type);
  const { error: updateError } = await supabase.from("training_groups").update({ branch_id: branchId, level_id: levelId, primary_coach_id: coachId, name: currentName, capacity, description, public_registration: publicRegistration }).eq("id", groupId).eq("organization_id", organizationId);
  if (updateError) throw updateError;

  const { error: deleteScheduleError } = await supabase.from("lesson_schedules").delete().eq("group_id", groupId).eq("organization_id", organizationId);
  if (deleteScheduleError) throw deleteScheduleError;
  const currentSchedules = weekdays.map((weekday) => ({ organization_id: organizationId, branch_id: branchId, group_id: groupId, coach_id: coachId, weekday, start_time: startTime, end_time: endTime, is_active: true }));
  const { error: currentScheduleError } = await supabase.from("lesson_schedules").insert(currentSchedules);
  if (currentScheduleError) throw currentScheduleError;

  const extraTypes = courseTypes.filter((type) => type !== existing.course_type);
  const created: string[] = [];
  for (const courseType of extraTypes) {
    const name = automaticName(branch.name, weekdays, startTime, courseType);
    const { data: sameName } = await supabase.from("training_groups").select("id").eq("organization_id", organizationId).eq("name", name).eq("is_active", true).maybeSingle();
    if (sameName) continue;

    const { data: newGroup, error: groupError } = await supabase.from("training_groups").insert({ organization_id: organizationId, branch_id: branchId, level_id: levelId, primary_coach_id: coachId, name, course_type: courseType, capacity, description, public_registration: publicRegistration, is_active: true }).select("id").single();
    if (groupError || !newGroup) throw groupError || new Error(`${courseType} grubu oluşturulamadı.`);
    created.push(newGroup.id);
    const rows = weekdays.map((weekday) => ({ organization_id: organizationId, branch_id: branchId, group_id: newGroup.id, coach_id: coachId, weekday, start_time: startTime, end_time: endTime, is_active: true }));
    const { error: scheduleError } = await supabase.from("lesson_schedules").insert(rows);
    if (scheduleError) throw scheduleError;
  }

  refresh();
  const message = created.length ? `Grup güncellendi ve ${created.length} ek kurs programı aynı seansa eklendi.` : "Grup başarıyla güncellendi.";
  redirect(`/gruplar?success=${encodeURIComponent(message)}`);
}
