"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const COURSE_TYPES = ["Çocuk Yüzme Kursu", "Yetişkin Yüzme Kursu", "Özel Ders", "Takım / Performans"];
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const clean = (v: FormDataEntryValue | null, max = 200) => String(v || "").trim().slice(0, max);
const time = (v: FormDataEntryValue | null) => clean(v, 5);

type DayScheduleInput = {
  weekday: number;
  startTime: string;
  endTime: string;
};

function courseTypeShort(courseType: string) {
  if (courseType === "Çocuk Yüzme Kursu") return "Çocuk";
  if (courseType === "Yetişkin Yüzme Kursu") return "Yetişkin";
  if (courseType === "Takım / Performans") return "Takım";
  return courseType;
}

function automaticName(branchName: string, schedules: DayScheduleInput[], courseType: string) {
  const sorted = [...schedules].sort((a, b) => a.weekday - b.weekday);
  const grouped = new Map<string, number[]>();

  for (const schedule of sorted) {
    const key = `${schedule.startTime}-${schedule.endTime}`;
    const days = grouped.get(key) || [];
    days.push(schedule.weekday);
    grouped.set(key, days);
  }

  const scheduleText = Array.from(grouped.entries())
    .map(([key, weekdays]) => {
      const startTime = key.split("-")[0] || "";
      const dayText = weekdays.map((weekday) => DAYS[weekday] || "").filter(Boolean).join("-");
      return [dayText, startTime].filter(Boolean).join(" ");
    })
    .join(" / ");

  return [branchName, scheduleText, courseTypeShort(courseType)].filter(Boolean).join(" · ");
}

function refresh() {
  const paths = ["/gruplar", "/on-kayit", "/on-kayitlar", "/kayit-tamamlama", "/yoklama", "/ders-programi", "/operasyon-plani", "/ogrenciler"];
  paths.forEach((path) => revalidatePath(path));
}

function readScheduleInputs(formData: FormData, weekdays: number[], defaultStart: string, defaultEnd: string) {
  const useDayTimes = formData.get("use_day_times") === "on";

  return weekdays.map((weekday) => {
    const startTime = useDayTimes ? time(formData.get(`day_start_${weekday}`)) : defaultStart;
    const endTime = useDayTimes ? time(formData.get(`day_end_${weekday}`)) : defaultEnd;

    if (!startTime || !endTime || endTime <= startTime) {
      throw new Error(`${DAYS[weekday] || "Seçili gün"} için ders saatlerini kontrol edin.`);
    }

    return { weekday, startTime, endTime };
  });
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
  const defaultStart = time(formData.get("start_time"));
  const defaultEnd = time(formData.get("end_time"));
  const publicRegistration = formData.get("public_registration") === "on";
  const weekdays = Array.from(new Set(formData.getAll("weekdays").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b);
  const courseTypes = Array.from(new Set(formData.getAll("course_types").map((v) => clean(v, 60)).filter((v) => COURSE_TYPES.includes(v))));

  if (!groupId || !branchId) throw new Error("Grup veya şube bilgisi eksik.");
  if (!courseTypes.length) throw new Error("En az bir kurs programı seçmelisiniz.");
  if (!weekdays.length) throw new Error("En az bir ders günü seçmelisiniz.");
  if (!defaultStart || !defaultEnd || defaultEnd <= defaultStart) throw new Error("Varsayılan ders saatlerini kontrol edin.");

  const requestedSchedules = readScheduleInputs(formData, weekdays, defaultStart, defaultEnd);

  const { data: existing, error: existingError } = await supabase
    .from("training_groups")
    .select("id,course_type")
    .eq("id", groupId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error("Düzenlenecek grup bulunamadı.");
  if (!courseTypes.includes(existing.course_type)) {
    throw new Error("Mevcut grup programı kaldırılamaz; grup geçmişini korumak için seçili bırakılmalıdır.");
  }

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id,name")
    .eq("id", branchId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (branchError) throw branchError;
  if (!branch) throw new Error("Şube bulunamadı veya aktif değil.");

  if (coachId) {
    const { data: coach } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", coachId)
      .eq("organization_id", organizationId)
      .eq("role", "coach")
      .eq("is_active", true)
      .maybeSingle();

    if (!coach) throw new Error("Seçilen eğitmen bulunamadı veya aktif değil.");
  }

  const currentName = automaticName(branch.name, requestedSchedules, existing.course_type);
  const { error: updateError } = await supabase
    .from("training_groups")
    .update({
      branch_id: branchId,
      level_id: levelId,
      primary_coach_id: coachId,
      name: currentName,
      capacity,
      description,
      public_registration: publicRegistration,
    })
    .eq("id", groupId)
    .eq("organization_id", organizationId);

  if (updateError) throw updateError;

  // Existing schedule ids are intentionally preserved. Other modules (attendance,
  // staff check-in, shared-session preferences, compensation lessons) may reference them.
  const { data: existingSchedules, error: existingSchedulesError } = await supabase
    .from("lesson_schedules")
    .select("id,weekday,start_time,end_time,is_active")
    .eq("group_id", groupId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (existingSchedulesError) throw existingSchedulesError;

  const existingByWeekday = new Map<number, typeof existingSchedules>();
  for (const schedule of existingSchedules || []) {
    const list = existingByWeekday.get(Number(schedule.weekday)) || [];
    list.push(schedule);
    existingByWeekday.set(Number(schedule.weekday), list);
  }

  for (const requested of requestedSchedules) {
    const candidates = existingByWeekday.get(requested.weekday) || [];
    const primary = candidates.find((item) => item.is_active) || candidates[0];

    if (primary) {
      const { error } = await supabase
        .from("lesson_schedules")
        .update({
          branch_id: branchId,
          coach_id: coachId,
          weekday: requested.weekday,
          start_time: requested.startTime,
          end_time: requested.endTime,
          is_active: true,
        })
        .eq("id", primary.id)
        .eq("organization_id", organizationId);

      if (error) throw error;

      const duplicateIds = candidates.filter((item) => item.id !== primary.id && item.is_active).map((item) => item.id);
      if (duplicateIds.length) {
        const { error: deactivateDuplicateError } = await supabase
          .from("lesson_schedules")
          .update({ is_active: false })
          .in("id", duplicateIds)
          .eq("organization_id", organizationId);

        if (deactivateDuplicateError) throw deactivateDuplicateError;
      }
    } else {
      const { error } = await supabase.from("lesson_schedules").insert({
        organization_id: organizationId,
        branch_id: branchId,
        group_id: groupId,
        coach_id: coachId,
        weekday: requested.weekday,
        start_time: requested.startTime,
        end_time: requested.endTime,
        is_active: true,
      });

      if (error) throw error;
    }
  }

  const selectedDaySet = new Set(requestedSchedules.map((item) => item.weekday));
  const schedulesToDeactivate = (existingSchedules || [])
    .filter((item) => !selectedDaySet.has(Number(item.weekday)) && item.is_active)
    .map((item) => item.id);

  if (schedulesToDeactivate.length) {
    const { error: deactivateError } = await supabase
      .from("lesson_schedules")
      .update({ is_active: false })
      .in("id", schedulesToDeactivate)
      .eq("organization_id", organizationId);

    if (deactivateError) throw deactivateError;
  }

  const extraTypes = courseTypes.filter((type) => type !== existing.course_type);
  const created: string[] = [];

  for (const courseType of extraTypes) {
    const name = automaticName(branch.name, requestedSchedules, courseType);
    const { data: sameName } = await supabase
      .from("training_groups")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", name)
      .eq("is_active", true)
      .maybeSingle();

    if (sameName) continue;

    const { data: newGroup, error: groupError } = await supabase
      .from("training_groups")
      .insert({
        organization_id: organizationId,
        branch_id: branchId,
        level_id: levelId,
        primary_coach_id: coachId,
        name,
        course_type: courseType,
        capacity,
        description,
        public_registration: publicRegistration,
        is_active: true,
      })
      .select("id")
      .single();

    if (groupError || !newGroup) throw groupError || new Error(`${courseType} grubu oluşturulamadı.`);
    created.push(newGroup.id);

    const rows = requestedSchedules.map((schedule) => ({
      organization_id: organizationId,
      branch_id: branchId,
      group_id: newGroup.id,
      coach_id: coachId,
      weekday: schedule.weekday,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      is_active: true,
    }));

    const { error: scheduleError } = await supabase.from("lesson_schedules").insert(rows);
    if (scheduleError) throw scheduleError;
  }

  refresh();
  const message = created.length
    ? `Grup güncellendi ve ${created.length} ek kurs programı aynı gün/saat planıyla eklendi.`
    : "Grup gün ve saat planı, mevcut seans bağlantıları korunarak güncellendi.";

  redirect(`/gruplar?success=${encodeURIComponent(message)}`);
}
