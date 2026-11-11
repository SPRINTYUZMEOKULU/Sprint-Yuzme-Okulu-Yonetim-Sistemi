export const TRIAL_POLICY_VERSION = "SPRINT-DENEME-2026-11-11-v2";
export const TRIAL_POLICY_TEXT = "Her kişi yalnızca bir kez deneme dersi alabilir. Başvuru, SPRİNT YÜZME OKULU tarafından onaylanmadan kabul edilmiş sayılmaz. Onaylanan deneme dersleri için bilgilendirme yapılır.";
export function trialIdentity(first:string,last:string):string {
  return `${first} ${last}`.normalize("NFKC").toLocaleLowerCase("tr-TR").replace(/\s+/g," ").trim();
}
