export type MakeupMessagePlan = { date: string; time?: string | null; group?: string | null; branch?: string | null };
export function makeupPlanLabel(plan: MakeupMessagePlan) {
  const [y,m,d]=plan.date.slice(0,10).split("-");
  return [`${d}.${m}.${y}`, plan.time, plan.branch, plan.group].filter(Boolean).join(" · ");
}
export function compensationChangeMessage(name: string, previous: MakeupMessagePlan, next: MakeupMessagePlan | null) {
  return `*SPRİNT YÜZME OKULU*\n\nSayın Velimiz / Kursiyerimiz,\n\n${name} için planlanan telafi dersi ${next ? "aşağıdaki şekilde düzenlenmiştir" : "iptal edilmiştir"}.\n\n*Önceki telafi:* ${makeupPlanLabel(previous)}\n${next ? `*Yeni telafi:* ${makeupPlanLabel(next)}\n\nLütfen yeni tarih ve saati dikkate alınız. Telafi hakkınız yeni plana taşınmıştır.` : "\nBu tarih ve seanstaki telafi planı kaldırılmıştır. Yeni bir tarih belirlenirse ayrıca bilgilendirme yapılacaktır."}\n\nSorularınız için bu numaradan bize ulaşabilirsiniz.\n\n*Sprint Yüzme Okulu*`;
}
export function compensationEndDate(normalEnd: string | null | undefined, lessons: {lesson_date:string;status:string}[]) {
  return lessons.filter(row=>row.status==="planned").reduce((end,row)=>row.lesson_date>end?row.lesson_date:end,normalEnd||"")||null;
}
