type DateValue = Date | string | number | null | undefined;
const zone = "Europe/Istanbul";
function displayDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00+03:00`);
    if (!Number.isFinite(date.getTime()) || new Intl.DateTimeFormat("en-CA", {timeZone: zone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date) !== value) return null;
    return date;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function format(value: DateValue, withTime: boolean): string {
  const date = displayDate(value);
  if (!date) return "—";
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric",
    ...(withTime ? {hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const} : {}),
  }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value || "";
  return `${part("day")}.${part("month")}.${part("year")}${withTime ? ` ${part("hour")}:${part("minute")}` : ""}`;
}
export const formatDisplayDate = (value: DateValue) => format(value, false);
export const formatDisplayDateTime = (value: DateValue) => format(value, true);
/** Presentation only: never apply to URLs, identifiers or stored date fields. */
export function formatDatesInText(value: string | null | undefined): string {
  return String(value ?? "").replace(/(?<![\w/?=&])\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?\b/g, match => {
    const formatted = match.includes("T") ? formatDisplayDateTime(match) : formatDisplayDate(match);
    return formatted === "—" ? match : formatted;
  });
}
