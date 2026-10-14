import { mergeCancellations, type CancellationSummary } from "@/lib/dashboard/cancellation-summary";
type Note = { id: string; title: string; text: string; status: string };
type StudentState = { id: string; status: string | null; blocked: boolean };
type GroupSummary = {
  id: string; branchId: string | null; branchName: string;
  groupId: string | null; groupName: string; startTime: string; endTime: string;
  studentCount: number; attendanceCount: number; attendanceComplete: boolean;
  missingCount: number; blockedCount: number;
  statusCounts: { present: number; absent: number; excused: number };
  notes: Note[]; notesAvailable: boolean; studentStates: StudentState[]; cancellation?: CancellationSummary;
};

// A dashboard card opens a branch/time slot. Groups remain separate attendance
// records inside that slot; this function only combines the read-only summary.
export function summarizeSessionSlots(rows: GroupSummary[]) {
  const slots = new Map<string, GroupSummary[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.branchId, row.startTime]);
    slots.set(key, [...(slots.get(key) || []), row]);
  }
  return [...slots.values()].map((groups) => {
    const first = groups[0];
    const students = new Map<string, StudentState>();
    const notes = new Map<string, Note>();
    for (const group of groups) {
      for (const student of group.studentStates) {
        if (group.cancellation?.studentIds.includes(student.id)) continue;
        const previous = students.get(student.id);
        if (!previous || (!previous.status && student.status) ||
          (!previous.status && previous.blocked && !student.blocked)) students.set(student.id, student);
      }
      for (const note of group.notes) notes.set(note.id, note);
    }
    const states = [...students.values()];
    const recorded = states.filter((student) => student.status);
    const missingCount = states.filter((student) => !student.status && !student.blocked).length;
    const cancellation = mergeCancellations(groups.flatMap(group=>group.cancellation?[group.cancellation]:[]));
    const cancelled = cancellation.studentIds.length > 0 && groups.filter(group=>group.studentStates.length > 0 || group.cancellation?.studentIds.length).every(group=>Boolean(group.cancellation?.studentIds.length) && group.studentStates.every(student=>group.cancellation!.studentIds.includes(student.id)));
    return {
      cancelled, cancellation,
      id: first.id, branchId: first.branchId, branchName: first.branchName,
      groupId: null, groupName: `${first.branchName} · ${first.startTime} Seansı`,
      groups: groups.map(({ id, groupId, groupName, studentCount, statusCounts, missingCount, cancellation }) =>
        ({ id, groupId, groupName, studentCount, statusCounts, missingCount, cancelled: Boolean(cancellation?.studentIds.length) && groups.find(group=>group.id===id)!.studentStates.every(student=>cancellation!.studentIds.includes(student.id)) })),
      startTime: first.startTime,
      endTime: [...new Set(groups.filter((group) => group.studentCount > 0).map((group) => group.endTime))].join(" / ") || first.endTime,
      studentCount: new Set(groups.flatMap(group=>group.studentStates.map(student=>student.id))).size, attendanceCount: recorded.length,
      attendanceComplete: recorded.length > 0 && missingCount === 0,
      missingCount, blockedCount: states.filter((student) => !student.status && student.blocked).length,
      statusCounts: {
        present: recorded.filter((student) => student.status === "present" || student.status === "compensation").length,
        absent: recorded.filter((student) => student.status === "absent").length,
        excused: recorded.filter((student) => student.status === "excused").length,
      },
      notes: [...notes.values()], notesAvailable: groups.every((group) => group.notesAvailable),
    };
  }).filter((slot) => slot.studentCount > 0 || slot.cancellation.studentIds.length > 0);
}
