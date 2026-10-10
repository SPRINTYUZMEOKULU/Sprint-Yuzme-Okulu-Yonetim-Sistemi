const DAYS: Record<number, string> = {1:"Pazartesi",2:"Salı",3:"Çarşamba",4:"Perşembe",5:"Cuma",6:"Cumartesi",7:"Pazar"};

export function registrationDaysLabel(days?: number[] | null) {
  const normalized = Array.from(new Set((days || []).map(Number).map(day => day === 0 ? 7 : day).filter(day => day >= 1 && day <= 7))).sort((a,b)=>a-b);
  return normalized.length ? normalized.map(day=>DAYS[day]).join(" · ") : "Kayıt günleri tanımlanmamış";
}

export function attendanceCourseLabel(group: {name?: string | null; course_type?: string | null}) {
  const text = `${group.course_type || ""} ${group.name || ""}`.toLocaleLowerCase("tr-TR");
  if (/takım|altyapı|alt yapı|performans|team/.test(text)) return "Takım";
  if (/yetişkin|adult/.test(text)) return "Yetişkin";
  if (/çocuk|child/.test(text)) return "Çocuk";
  return group.course_type || "Grup";
}
