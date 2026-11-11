export const TRIAL_POLICY_VERSION = "SPRINT-DENEME-2026-11-11";
export const TRIAL_POLICY_TEXT = "Deneme dersi yalnızca 6 yaş ve altındaki çocuklar için geçerlidir. Yetişkinler için deneme dersimiz yoktur. Her çocuk yalnızca bir kez deneme dersi alabilir. Başvuru, SPRİNT YÜZME OKULU tarafından onaylanmadan kabul edilmiş sayılmaz. Onaylanan deneme dersleri için bilgilendirme yapılır.";
export function turkeyToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part = (type:string)=>parts.find(p=>p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function trialEligibilityError(registrationFor: string | null | undefined, birthDate: string | null | undefined, onDate=turkeyToday()): string | null {
  if (registrationFor !== "child") return "Yetişkinler için deneme dersimiz bulunmuyor. Deneme dersi yalnızca 6 yaş ve altındaki çocuklar içindir.";
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return "Deneme talebi için çocuğun doğum tarihini giriniz.";
  const birth = new Date(`${birthDate}T12:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0,10) !== birthDate || birthDate > onDate) return "Çocuğun doğum tarihini kontrol ediniz.";
  const [year,month,day] = onDate.split("-").map(Number);
  let age=year-birth.getUTCFullYear();
  if (month < birth.getUTCMonth()+1 || (month === birth.getUTCMonth()+1 && day < birth.getUTCDate())) age--;
  return age > 6 ? "Deneme dersi yalnızca 6 yaş ve altındaki çocuklar için geçerlidir." : null;
}
export function trialIdentity(first:string,last:string):string {
  return `${first} ${last}`.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/\s+/g," ").trim();
}
