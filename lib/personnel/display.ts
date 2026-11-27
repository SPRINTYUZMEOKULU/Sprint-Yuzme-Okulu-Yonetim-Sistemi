export function cleanStaffName(value?: string | null) {
  const name = value?.trim() || "";
  return /^[-–—]+$/.test(name) ? "" : name;
}
