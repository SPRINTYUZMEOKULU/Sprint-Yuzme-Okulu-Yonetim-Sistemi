export type FollowupStatus = "open" | "completed" | "removed";
export type AttendanceSlot = { date: string; branchId: string; time: string };
export function attendanceSlotKey(slot: AttendanceSlot) {
  return JSON.stringify([slot.date, slot.branchId, slot.time.slice(0, 5)]);
}
export function validFollowup(body: any, today: string, start: string) {
  if (!body || typeof body !== "object") return false;
  const { date, branchId, time, status } = body;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  return date >= start && date < today
    && typeof branchId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)
    && typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    && ["open", "completed", "removed"].includes(status);
}
export function partitionAttendance<T extends AttendanceSlot>(slots: T[], followups: Array<AttendanceSlot & { status: FollowupStatus; updatedAt?: string }>) {
  const bySlot = new Map(followups.map(row => [attendanceSlotKey(row), row]));
  return {
    pending: slots.filter(slot => !bySlot.has(attendanceSlotKey(slot)) || bySlot.get(attendanceSlotKey(slot))?.status === "open"),
    closed: slots.flatMap(slot => {
      const followup = bySlot.get(attendanceSlotKey(slot));
      return followup && followup.status !== "open" ? [{ ...slot, status: followup.status, updatedAt: followup.updatedAt }] : [];
    }),
  };
}
