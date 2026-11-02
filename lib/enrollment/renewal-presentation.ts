export function renewalPresentation(next: any) {
  if (!next || next.status !== "scheduled") return null;
  return {title: "Kayıt yenilendi · Yeni dönem hazır", startDate: next.start_date, endDate: next.planned_end_date,
    lessons: Number(next.total_lessons || 0), enrollmentId: next.id};
}
export function correctionOverlapsRenewal(start: string, end: string, next: any) {
  return Boolean(next?.status === "scheduled" && (start >= next.start_date || end >= next.start_date));
}
