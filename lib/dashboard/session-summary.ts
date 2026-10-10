type Note = { id: string; title: string; text: string; status: string };
type StudentState = { id: string; status: string | null; blocked: boolean };
type GroupSummary = {
  id: string; branchId: string | null; branchName: string;
  groupId: string | null; groupName: string; startTime: string; endTime: string;
  studentCount: number; attendanceCount: number; attendanceComplete: boolean;
  missingCount: number; blockedCount: number;
  statusCounts: { present: number; absent: number; excused: number };
  notes: Note[]; notesAvailable: boolean; studentStates: StudentState[];
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
        const previous = students.get(student.id);
        if (!previous || (!previous.status && student.status) ||
          (!previous.status && previous.blocked && !student.blocked)) students.set(student.id, student);
      }
      for (const note of group.notes) notes.set(note.id, note);
    }
    const states = [...students.values()];
    const recorded = states.filter((student) => student.status);
    const missingCount = states.filter((student) => !student.status && !student.blocked).length;
    return {
      id: first.id, branchId: first.branchId, branchName: first.branchName,
      groupId: null, groupName: `${first.branchName} · ${first.startTime} Seansı`,
      groups: groups.map(({ id, groupId, groupName, studentCount, statusCounts, missingCount }) =>
        ({ id, groupId, groupName, studentCount, statusCounts, missingCount })),
      startTime: first.startTime,
      endTime: [...new Set(groups.filter((group) => group.studentCount > 0).map((group) => group.endTime))].join(" / ") || first.endTime,
      studentCount: states.length, attendanceCount: recorded.length,
      attendanceComplete: recorded.length > 0 && missingCount === 0,
      missingCount, blockedCount: states.filter((student) => !student.status && student.blocked).length,
      statusCounts: {
        present: recorded.filter((student) => student.status === "present" || student.status === "compensation").length,
        absent: recorded.filter((student) => student.status === "absent").length,
        excused: recorded.filter((student) => student.status === "excused").length,
      },
      notes: [...notes.values()], notesAvailable: groups.every((group) => group.notesAvailable),
    };
  }).filter((slot) => slot.studentCount > 0);
}
