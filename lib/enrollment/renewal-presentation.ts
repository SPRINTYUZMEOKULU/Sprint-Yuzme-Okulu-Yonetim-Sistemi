export function renewalPresentation(next: any) {
  if (!next || next.status !== "scheduled") return null;
  return {title: "Yeni kayıt yapıldı", startDate: next.start_date, endDate: next.planned_end_date,
    lessons: Number(next.total_lessons || 0), enrollmentId: next.id};
}
export function correctionOverlapsRenewal(start: string, end: string, next: any) {
  return Boolean(next?.status === "scheduled" && (start >= next.start_date || end >= next.start_date));
}

export function renewalNote(startDate: string, endDate: string, lessons: number) {
  const date = (value: string) => value.split("-").reverse().join("/");
  return `Yeni kayıt yapıldı. Yeni dönem: ${date(startDate)} – ${date(endDate)} · ${lessons} ders. Mevcut dönem tamamlanana kadar mevcut kayıttan devam edilir. Ardından belirlenen başlangıç tarihinde yeni kayıt otomatik devreye girer.`;
}
