export type ActiveSource = {
  id: string;
  is_active?: boolean | null;
};

export type EffectiveSchedule = {
  branch_id?: string | null;
  group_id?: string | null;
  is_active?: boolean | null;
};

export function activeSourceIds(items: ActiveSource[]) {
  return new Set(
    items
      .filter((item) => item.is_active !== false)
      .map((item) => item.id)
  );
}

export function isScheduleEffectivelyActive(
  schedule: EffectiveSchedule,
  activeBranchIds: Set<string>,
  activeGroupIds: Set<string>
) {
  return (
    schedule.is_active === true &&
    Boolean(schedule.branch_id) &&
    Boolean(schedule.group_id) &&
    activeBranchIds.has(String(schedule.branch_id)) &&
    activeGroupIds.has(String(schedule.group_id))
  );
}

export function filterEffectivelyActiveSchedules<T extends EffectiveSchedule>(
  schedules: T[],
  branches: ActiveSource[],
  groups: ActiveSource[]
) {
  const branchIds = activeSourceIds(branches);
  const groupIds = activeSourceIds(groups);

  return schedules.filter((schedule) =>
    isScheduleEffectivelyActive(schedule, branchIds, groupIds)
  );
}
