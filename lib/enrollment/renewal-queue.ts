export const RENEWAL_QUEUE_KEY = "sprint:bulk-renewal-queue";
export function readRenewalQueue(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string =>
                typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
export function advanceRenewalQueue(
  ids: string[],
  completedId: string,
): string[] {
  return ids.filter((id) => id !== completedId);
}
