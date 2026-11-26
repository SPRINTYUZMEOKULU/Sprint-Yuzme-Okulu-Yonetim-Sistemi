export function isAdultCourse(value?: string | null) {
  return /yetişkin|yetiskin|adult|master/.test((value || "").toLocaleLowerCase("tr-TR"));
}

function makeupCourse(value?: string | null, name?: string | null) {
  const text = (value || "").toLocaleLowerCase("tr-TR");
  const team = /takım|takim|alt\s*yap[ıi]|performans|\bteam\b/;
  if (team.test(text) || team.test((name || "").toLocaleLowerCase("tr-TR"))) return "team";
  return isAdultCourse(text) ? "adult" : "child";
}

type MakeupGroup = { branch_id: string | null; course_type?: string | null; name?: string | null };

export function compatibleMakeupGroups(source?: MakeupGroup | null, target?: MakeupGroup | null) {
  return Boolean(source && target && source.branch_id && source.branch_id === target.branch_id
    && makeupCourse(source.course_type, source.name) === makeupCourse(target.course_type, target.name));
}
