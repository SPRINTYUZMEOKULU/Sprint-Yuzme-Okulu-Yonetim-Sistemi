import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type ScopeContextInput = {
  organizationId: string;
  studentId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export type NotificationScopeContext = {
  branchId: string | null;
  groupId: string | null;
  scheduleId: string | null;
  enrollmentId: string | null;
  assignedProfileIds: Set<string>;
  hasAssignableContext: boolean;
};

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataString(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = asString(metadata?.[key]);
    if (value) return value;
  }
  return null;
}

function metadataStrings(metadata: Record<string, unknown> | undefined, keys: string[]) {
  const result = new Set<string>();
  for (const key of keys) {
    const value = metadata?.[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const id = asString(item);
        if (id) result.add(id);
      }
    }
  }
  return result;
}

function idFromSource(input: ScopeContextInput, types: string[]) {
  const sourceType = String(input.sourceType || "").toLowerCase();
  const entityType = String(input.entityType || "").toLowerCase();
  if (types.includes(sourceType)) return asString(input.sourceId);
  if (types.includes(entityType)) return asString(input.entityId);
  return null;
}

export async function resolveNotificationScopeContext(
  admin: SupabaseClient,
  input: ScopeContextInput
): Promise<NotificationScopeContext> {
  const assignedProfileIds = metadataStrings(input.metadata, [
    "assignedProfileIds",
    "assigned_profile_ids",
    "coachProfileIds",
    "coach_profile_ids",
  ]);
  for (const key of [
    "assignedProfileId",
    "assigned_profile_id",
    "coachProfileId",
    "coach_profile_id",
    "primaryCoachId",
    "primary_coach_id",
  ]) {
    const value = asString(input.metadata?.[key]);
    if (value) assignedProfileIds.add(value);
  }

  let branchId = metadataString(input.metadata, ["branchId", "branch_id"]);
  let groupId = metadataString(input.metadata, ["groupId", "group_id"])
    ?? idFromSource(input, ["group", "training_group"]);
  let scheduleId = metadataString(input.metadata, ["scheduleId", "schedule_id", "lessonScheduleId", "lesson_schedule_id"])
    ?? idFromSource(input, ["schedule", "lesson_schedule"]);
  let enrollmentId = metadataString(input.metadata, ["enrollmentId", "enrollment_id"])
    ?? idFromSource(input, ["enrollment", "student_enrollment"]);
  const studentId = asString(input.studentId)
    ?? metadataString(input.metadata, ["studentId", "student_id"])
    ?? idFromSource(input, ["student"]);

  const coachStaffIds = new Set<string>();

  // Enrollment is the canonical fallback for a student's current branch/group.
  if (enrollmentId) {
    const { data, error } = await admin
      .from("student_enrollments")
      .select("id,student_id,branch_id,group_id,status,updated_at")
      .eq("organization_id", input.organizationId)
      .eq("id", enrollmentId)
      .maybeSingle();
    if (error) console.error("SprintOS notification enrollment scope:", error);
    if (data) {
      branchId ||= asString(data.branch_id);
      groupId ||= asString(data.group_id);
    }
  } else if (studentId && (!branchId || !groupId)) {
    const { data, error } = await admin
      .from("student_enrollments")
      .select("id,branch_id,group_id,status,updated_at")
      .eq("organization_id", input.organizationId)
      .eq("student_id", studentId)
      .in("status", ["active", "planned", "pending"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) console.error("SprintOS notification student enrollment scope:", error);
    if (data) {
      enrollmentId = asString(data.id);
      branchId ||= asString(data.branch_id);
      groupId ||= asString(data.group_id);
    }
  }

  // Direct student-to-session assignment is the strongest coach relationship.
  if (studentId) {
    let query = admin
      .from("lesson_student_assignments")
      .select("branch_id,group_id,schedule_id,coach_id")
      .eq("organization_id", input.organizationId)
      .eq("student_id", studentId)
      .eq("is_active", true);
    if (scheduleId) query = query.eq("schedule_id", scheduleId);
    else if (groupId) query = query.eq("group_id", groupId);
    const { data, error } = await query;
    if (error) console.error("SprintOS notification student assignment scope:", error);
    for (const row of data ?? []) {
      branchId ||= asString(row.branch_id);
      groupId ||= asString(row.group_id);
      scheduleId ||= asString(row.schedule_id);
      const coachId = asString(row.coach_id);
      if (coachId) coachStaffIds.add(coachId);
    }
  }

  // Group primary coach provides a reliable fallback when no per-student coach is stored.
  if (groupId) {
    const { data, error } = await admin
      .from("training_groups")
      .select("branch_id,primary_coach_id")
      .eq("organization_id", input.organizationId)
      .eq("id", groupId)
      .maybeSingle();
    if (error) console.error("SprintOS notification group scope:", error);
    if (data) {
      branchId ||= asString(data.branch_id);
      const coachId = asString(data.primary_coach_id);
      if (coachId) coachStaffIds.add(coachId);
    }
  }

  // Schedule and staff assignments cover multi-coach sessions.
  if (scheduleId || groupId) {
    let scheduleQuery = admin
      .from("lesson_schedules")
      .select("id,branch_id,group_id,coach_id")
      .eq("organization_id", input.organizationId)
      .eq("is_active", true);
    scheduleQuery = scheduleId ? scheduleQuery.eq("id", scheduleId) : scheduleQuery.eq("group_id", groupId!);
    const { data: schedules, error: scheduleError } = await scheduleQuery;
    if (scheduleError) console.error("SprintOS notification schedule scope:", scheduleError);
    for (const row of schedules ?? []) {
      scheduleId ||= asString(row.id);
      branchId ||= asString(row.branch_id);
      groupId ||= asString(row.group_id);
      const coachId = asString(row.coach_id);
      if (coachId) coachStaffIds.add(coachId);
    }

    let staffAssignmentQuery = admin
      .from("lesson_staff_assignments")
      .select("branch_id,group_id,schedule_id,coach_id")
      .eq("organization_id", input.organizationId)
      .eq("is_active", true);
    staffAssignmentQuery = scheduleId
      ? staffAssignmentQuery.eq("schedule_id", scheduleId)
      : staffAssignmentQuery.eq("group_id", groupId!);
    const { data: staffAssignments, error: staffAssignmentError } = await staffAssignmentQuery;
    if (staffAssignmentError) console.error("SprintOS notification staff assignment scope:", staffAssignmentError);
    for (const row of staffAssignments ?? []) {
      branchId ||= asString(row.branch_id);
      groupId ||= asString(row.group_id);
      scheduleId ||= asString(row.schedule_id);
      const coachId = asString(row.coach_id);
      if (coachId) coachStaffIds.add(coachId);
    }
  }

  // coach_id columns reference staff.id; notification rules reference profiles/auth users.
  if (coachStaffIds.size) {
    const { data, error } = await admin
      .from("staff")
      .select("id,auth_user_id")
      .eq("organization_id", input.organizationId)
      .eq("is_active", true)
      .in("id", Array.from(coachStaffIds));
    if (error) console.error("SprintOS notification coach profile scope:", error);
    for (const row of data ?? []) {
      const profileId = asString(row.auth_user_id);
      if (profileId) assignedProfileIds.add(profileId);
    }
  }

  return {
    branchId,
    groupId,
    scheduleId,
    enrollmentId,
    assignedProfileIds,
    hasAssignableContext: Boolean(studentId || groupId || scheduleId || enrollmentId),
  };
}
