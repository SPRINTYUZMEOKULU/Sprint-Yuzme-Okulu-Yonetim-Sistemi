"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const DAY_SHORT_NAMES = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

const ALLOWED_COURSE_TYPES = [
  "Çocuk Yüzme Kursu",
  "Yetişkin Yüzme Kursu",
  "Özel Ders",
  "Takım / Performans",
];

function cleanText(value: FormDataEntryValue | null, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function toTime(value: FormDataEntryValue | null) {
  return String(value || "").trim().slice(0, 5);
}

function createAutomaticGroupName({
  branchName,
  weekdays,
  startTime,
  courseType,
}: {
  branchName: string;
  weekdays: number[];
  startTime: string;
  courseType: string;
}) {
  const dayText = weekdays
    .sort((a, b) => a - b)
    .map((weekday) => DAY_SHORT_NAMES[weekday] || "")
    .filter(Boolean)
    .join("-");

  let typeText = courseType;

  if (courseType === "Çocuk Yüzme Kursu") typeText = "Çocuk";
  if (courseType === "Yetişkin Yüzme Kursu") typeText = "Yetişkin";
  if (courseType === "Takım / Performans") typeText = "Takım";

  return [branchName, dayText, startTime, typeText].filter(Boolean).join(" · ");
}

function refreshGroupPages() {
  revalidatePath("/gruplar");
  revalidatePath("/on-kayit");
  revalidatePath("/on-kayitlar");
  revalidatePath("/kayit-tamamlama");
  revalidatePath("/yoklama");
  revalidatePath("/ders-programi");
  revalidatePath("/operasyon-plani");
  revalidatePath("/ogrenciler");
}

async function getOrganizationContext() {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const organizationId = profile.organization_id;

  if (!organizationId) {
    throw new Error("Kurum bilgisi bulunamadı.");
  }

  const supabase = await createClient();
  return { organizationId, supabase };
}

export async function createGroup(formData: FormData) {
  const { organizationId, supabase } = await getOrganizationContext();

  const branchId = cleanText(formData.get("branch_id"), 80);
  const levelId = cleanText(formData.get("level_id"), 80) || null;
  const capacity = Math.min(50, Math.max(1, Number(formData.get("capacity") || 6)));

  const weekdays = Array.from(
    new Set(
      formData
        .getAll("weekdays")
        .map(Number)
        .filter(
          (weekday) =>
            Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
        )
    )
  ).sort((a, b) => a - b);

  const startTime = toTime(formData.get("start_time"));
  const endTime = toTime(formData.get("end_time"));
  const description = cleanText(formData.get("description"), 500) || null;
  const publicRegistration = formData.get("public_registration") === "on";

  const requestedCourseTypes = formData
    .getAll("course_types")
    .map((value) => cleanText(value, 60))
    .filter((value) => ALLOWED_COURSE_TYPES.includes(value));

  const legacyCourseType = cleanText(formData.get("course_type"), 60);
  const courseTypes = Array.from(
    new Set(
      requestedCourseTypes.length
        ? requestedCourseTypes
        : ALLOWED_COURSE_TYPES.includes(legacyCourseType)
          ? [legacyCourseType]
          : []
    )
  );

  if (!branchId) throw new Error("Şube seçmelisiniz.");
  if (!courseTypes.length) throw new Error("En az bir grup türü seçmelisiniz.");
  if (!weekdays.length) throw new Error("En az bir ders günü seçmelisiniz.");
  if (!startTime || !endTime) {
    throw new Error("Başlangıç ve bitiş saatini girmelisiniz.");
  }
  if (endTime <= startTime) {
    throw new Error("Bitiş saati başlangıç saatinden sonra olmalıdır.");
  }

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id,name")
    .eq("id", branchId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (branchError) throw branchError;
  if (!branch) throw new Error("Seçilen şube bulunamadı veya aktif değil.");

  const createdGroupIds: string[] = [];

  try {
    for (const courseType of courseTypes) {
      const automaticName = createAutomaticGroupName({
        branchName: branch.name,
        weekdays,
        startTime,
        courseType,
      });

      const { data: group, error: groupError } = await supabase
        .from("training_groups")
        .insert({
          organization_id: organizationId,
          branch_id: branchId,
          level_id: levelId,
          name: automaticName,
          course_type: courseType,
          capacity,
          public_registration: publicRegistration,
          description,
          is_active: true,
        })
        .select("id")
        .single();

      if (groupError || !group) {
        throw groupError || new Error(`${courseType} grubu oluşturulamadı.`);
      }

      createdGroupIds.push(group.id);

      const scheduleRows = weekdays.map((weekday) => ({
        organization_id: organizationId,
        branch_id: branchId,
        group_id: group.id,
        weekday,
        start_time: startTime,
        end_time: endTime,
        is_active: true,
      }));

      const { error: scheduleError } = await supabase
        .from("lesson_schedules")
        .insert(scheduleRows);

      if (scheduleError) throw scheduleError;
    }
  } catch (error) {
    if (createdGroupIds.length) {
      await supabase
        .from("lesson_schedules")
        .delete()
        .in("group_id", createdGroupIds)
        .eq("organization_id", organizationId);

      await supabase
        .from("training_groups")
        .delete()
        .in("id", createdGroupIds)
        .eq("organization_id", organizationId);
    }

    throw error;
  }

  refreshGroupPages();
}

export async function toggleGroup(formData: FormData) {
  const { organizationId, supabase } = await getOrganizationContext();

  const id = cleanText(formData.get("id"), 80);
  const field = cleanText(formData.get("field"), 40);
  const value = String(formData.get("value") || "") === "true";

  if (!id || !["is_active", "public_registration"].includes(field)) {
    throw new Error("Geçersiz işlem.");
  }

  const { error } = await supabase
    .from("training_groups")
    .update({ [field]: value })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) throw error;

  if (field === "is_active") {
    const { error: scheduleError } = await supabase
      .from("lesson_schedules")
      .update({ is_active: value })
      .eq("group_id", id)
      .eq("organization_id", organizationId);

    if (scheduleError) throw scheduleError;
  }

  refreshGroupPages();
}

export async function deleteGroup(formData: FormData) {
  const { organizationId, supabase } = await getOrganizationContext();
  const id = cleanText(formData.get("id"), 80);

  if (!id) throw new Error("Silinecek grup bulunamadı.");

  const { data: group, error: groupError } = await supabase
    .from("training_groups")
    .select("id,name")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (groupError) throw groupError;
  if (!group) throw new Error("Grup bulunamadı.");

  const [activeMembershipsResult, activePreferredStudentsResult] =
    await Promise.all([
      supabase
        .from("student_group_memberships")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("group_id", id)
        .eq("is_active", true),

      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("preferred_group_id", id)
        .eq("status", "active")
        .eq("is_deleted", false),
    ]);

  const activeRelationError =
    activeMembershipsResult.error || activePreferredStudentsResult.error;

  if (activeRelationError) throw activeRelationError;

  const activeStudentCount = Math.max(
    activeMembershipsResult.count || 0,
    activePreferredStudentsResult.count || 0
  );

  if (activeStudentCount > 0) {
    const message = `"${group.name}" grubunda ${activeStudentCount} aktif öğrenci bulunduğu için silinemez. Önce öğrencileri başka gruba aktarın.`;
    redirect(`/gruplar?error=${encodeURIComponent(message)}`);
  }

  const [membershipsResult, enrollmentsResult, attendanceResult] =
    await Promise.all([
      supabase
        .from("student_group_memberships")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("group_id", id),

      supabase
        .from("student_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("group_id", id),

      supabase
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("group_id", id),
    ]);

  const historyError =
    membershipsResult.error || enrollmentsResult.error || attendanceResult.error;

  if (historyError) throw historyError;

  const historicalRecordCount =
    (membershipsResult.count || 0) +
    (enrollmentsResult.count || 0) +
    (attendanceResult.count || 0);

  // Geçmiş kayıt/yoklama varsa fiziksel silme yapmıyoruz.
  // Grup aktif operasyonlardan kaldırılıyor, geçmiş veriler öğrencinin dosyasında korunuyor.
  if (historicalRecordCount > 0) {
    const { error: archiveGroupError } = await supabase
      .from("training_groups")
      .update({
        is_active: false,
        public_registration: false,
      })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (archiveGroupError) throw archiveGroupError;

    const { error: archiveScheduleError } = await supabase
      .from("lesson_schedules")
      .update({ is_active: false })
      .eq("group_id", id)
      .eq("organization_id", organizationId);

    if (archiveScheduleError) throw archiveScheduleError;

    refreshGroupPages();

    redirect(
      `/gruplar?success=${encodeURIComponent(
        "Grup aktif listeden kaldırıldı. Geçmiş kayıt ve yoklamalar korundu."
      )}`
    );
  }

  const { error: scheduleError } = await supabase
    .from("lesson_schedules")
    .delete()
    .eq("group_id", id)
    .eq("organization_id", organizationId);

  if (scheduleError) throw scheduleError;

  const { error: deleteError } = await supabase
    .from("training_groups")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (deleteError) throw deleteError;

  refreshGroupPages();

  redirect(
    `/gruplar?success=${encodeURIComponent("Grup başarıyla silindi.")}`
  );
}

export async function updateGroup(formData: FormData) {
  const { organizationId, supabase } = await getOrganizationContext();

  const groupId = cleanText(formData.get("group_id"), 80);
  const branchId = cleanText(formData.get("branch_id"), 80);
  const groupName = cleanText(formData.get("name"), 160);
  const courseType = cleanText(formData.get("course_type"), 60);
  const levelId = cleanText(formData.get("level_id"), 80) || null;
  const coachId = cleanText(formData.get("primary_coach_id"), 80) || null;
  const capacity = Math.min(50, Math.max(1, Number(formData.get("capacity") || 6)));
  const description = cleanText(formData.get("description"), 500) || null;
  const startTime = toTime(formData.get("start_time"));
  const endTime = toTime(formData.get("end_time"));

  const weekdays = Array.from(
    new Set(
      formData
        .getAll("weekdays")
        .map(Number)
        .filter(
          (weekday) =>
            Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
        )
    )
  ).sort((a, b) => a - b);

  const publicRegistration = formData.get("public_registration") === "on";

  if (!groupId) throw new Error("Düzenlenecek grup bulunamadı.");
  if (!branchId) throw new Error("Şube seçmelisiniz.");
  if (!groupName) throw new Error("Eğitim grubu adı girmelisiniz.");
  if (!ALLOWED_COURSE_TYPES.includes(courseType)) {
    throw new Error("Geçerli bir kurs programı seçmelisiniz.");
  }
  if (!weekdays.length) throw new Error("En az bir ders günü seçmelisiniz.");
  if (!startTime || !endTime) {
    throw new Error("Başlangıç ve bitiş saatini girmelisiniz.");
  }
  if (endTime <= startTime) {
    throw new Error("Bitiş saati başlangıç saatinden sonra olmalıdır.");
  }

  const { data: existingGroup } = await supabase
    .from("training_groups")
    .select("id")
    .eq("id", groupId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!existingGroup) throw new Error("Düzenlenecek grup bulunamadı.");

  if (coachId) {
    const { data: coach } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", coachId)
      .eq("organization_id", organizationId)
      .eq("role", "coach")
      .eq("is_active", true)
      .maybeSingle();

    if (!coach) {
      throw new Error("Seçilen eğitmen bulunamadı veya aktif değil.");
    }
  }

  const { error: groupUpdateError } = await supabase
    .from("training_groups")
    .update({
      branch_id: branchId,
      level_id: levelId,
      primary_coach_id: coachId,
      name: groupName,
      course_type: courseType,
      capacity,
      description,
      public_registration: publicRegistration,
    })
    .eq("id", groupId)
    .eq("organization_id", organizationId);

  if (groupUpdateError) throw groupUpdateError;

  const { error: removeScheduleError } = await supabase
    .from("lesson_schedules")
    .delete()
    .eq("group_id", groupId)
    .eq("organization_id", organizationId);

  if (removeScheduleError) throw removeScheduleError;

  const scheduleRows = weekdays.map((weekday) => ({
    organization_id: organizationId,
    branch_id: branchId,
    group_id: groupId,
    coach_id: coachId,
    weekday,
    start_time: startTime,
    end_time: endTime,
    is_active: true,
  }));

  const { error: scheduleError } = await supabase
    .from("lesson_schedules")
    .insert(scheduleRows);

  if (scheduleError) throw scheduleError;

  refreshGroupPages();

  redirect(
    `/gruplar?success=${encodeURIComponent(
      `${groupName} grubu başarıyla güncellendi.`
    )}`
  );
}
