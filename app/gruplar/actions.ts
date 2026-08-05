"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const toTime = (value: FormDataEntryValue | null) => String(value || "").slice(0, 5);

export async function createGroup(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  if (!profile.organization_id) throw new Error("Kurum bilgisi bulunamadı.");
  const supabase = await createClient();

  const branchId = String(formData.get("branch_id") || "");
  const name = String(formData.get("name") || "").trim();
  const courseType = String(formData.get("course_type") || "Çocuk Yüzme Kursu");
  const levelId = String(formData.get("level_id") || "") || null;
  const capacity = Math.max(1, Number(formData.get("capacity") || 6));
  const weekdays = formData.getAll("weekdays").map(Number).filter((n) => n >= 0 && n <= 6);
  const startTime = toTime(formData.get("start_time"));
  const endTime = toTime(formData.get("end_time"));

  if (!branchId || !name || !weekdays.length || !startTime || !endTime) throw new Error("Grup bilgilerini eksiksiz girin.");

  const { data: group, error } = await supabase.from("training_groups").insert({
    organization_id: profile.organization_id,
    branch_id: branchId,
    level_id: levelId,
    name,
    course_type: courseType,
    capacity,
    public_registration: formData.get("public_registration") === "on",
    description: String(formData.get("description") || "").trim() || null,
    is_active: true
  }).select("id").single();
  if (error || !group) throw error || new Error("Grup oluşturulamadı.");

  const rows = weekdays.map((weekday) => ({
    organization_id: profile.organization_id,
    branch_id: branchId,
    group_id: group.id,
    weekday,
    start_time: startTime,
    end_time: endTime,
    is_active: true
  }));
  const { error: scheduleError } = await supabase.from("lesson_schedules").insert(rows);
  if (scheduleError) {
    await supabase.from("training_groups").delete().eq("id", group.id);
    throw scheduleError;
  }
  revalidatePath("/gruplar");
  revalidatePath("/on-kayit");
}

export async function toggleGroup(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const field = String(formData.get("field") || "");
  const value = String(formData.get("value") || "") === "true";
  if (!id || !["is_active", "public_registration"].includes(field)) throw new Error("Geçersiz işlem.");
  const { error } = await supabase.from("training_groups").update({ [field]: value }).eq("id", id).eq("organization_id", profile.organization_id);
  if (error) throw error;
  revalidatePath("/gruplar");
  revalidatePath("/on-kayit");
}
