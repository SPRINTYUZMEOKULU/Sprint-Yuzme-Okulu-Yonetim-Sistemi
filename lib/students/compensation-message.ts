export type MakeupMessagePlan = { date: string; time?: string | null; group?: string | null; branch?: string | null };
export function makeupPlanLabel(plan: MakeupMessagePlan) {
  const [y,m,d]=plan.date.slice(0,10).split("-");
  return [`${d}.${m}.${y}`, plan.time, plan.branch, plan.group].filter(Boolean).join(" · ");
}
export function compensationChangeMessage(name: string, previous: MakeupMessagePlan, next: MakeupMessagePlan | null, initial = false) {
  if(initial&&next)return `*SPRİNT YÜZME OKULU*\n\nSayın Velimiz / Kursiyerimiz,\n\n${name} için ${makeupPlanLabel(previous)} tarihli iptal edilen dersten saklı tutulan telafi hakkı planlanmıştır.\n\n*Telafi dersi:* ${makeupPlanLabel(next)}\n\nLütfen belirtilen tarih ve saatte katılım sağlayınız. Mevcut telafi hakkınız kullanılarak planlama yapılmıştır.\n\n*Sprint Yüzme Okulu*`;
  return `*SPRİNT YÜZME OKULU*\n\nSayın Velimiz / Kursiyerimiz,\n\n${name} için planlanan telafi dersi ${next ? "aşağıdaki şekilde düzenlenmiştir" : "iptal edilmiştir"}.\n\n*Önceki telafi:* ${makeupPlanLabel(previous)}\n${next ? `*Yeni telafi:* ${makeupPlanLabel(next)}\n\nLütfen yeni tarih ve saati dikkate alınız. Telafi hakkınız yeni plana taşınmıştır.` : "\nBu tarih ve seanstaki telafi planı kaldırılmıştır. Yeni bir tarih belirlenirse ayrıca bilgilendirme yapılacaktır."}\n\nSorularınız için bu numaradan bize ulaşabilirsiniz.\n\n*Sprint Yüzme Okulu*`;
}
export function latestPlannedMakeupDate(lessons: { lesson_date: string; status: string }[]) {
  return lessons.reduce<string | null>((latest, lesson) =>
    lesson.status === "planned" && (!latest || lesson.lesson_date > latest)
      ? lesson.lesson_date
      : latest, null);
}

export function compensationEndDate(normalEnd: string | null | undefined, lessons: {lesson_date:string;status:string}[]) {
  const lastMakeup = latestPlannedMakeupDate(lessons);
  return lastMakeup && (!normalEnd || lastMakeup > normalEnd) ? lastMakeup : normalEnd || null;
}
