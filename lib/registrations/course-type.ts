/** Package values use short keys; groups historically use Turkish labels. */
export function normalizeCourseType(value?: string | null): string {
  const text = (value || "").trim().toLocaleLowerCase("tr-TR");
  if (["child", "çocuk", "çocuk yüzme kursu"].includes(text)) return "child";
  if (["adult", "yetişkin", "yetişkin yüzme kursu"].includes(text)) return "adult";
  if (["team", "takım", "takım / performans", "altyapı", "performans"].includes(text)) return "team";
  if (["private", "özel", "özel ders"].includes(text)) return "private";
  return text;
}
export function packageMatchesCourse(packageType?: string | null, groupType?: string | null): boolean {
  const pack = normalizeCourseType(packageType);
  const group = normalizeCourseType(groupType);
  return !pack || !group || pack === group;
}
