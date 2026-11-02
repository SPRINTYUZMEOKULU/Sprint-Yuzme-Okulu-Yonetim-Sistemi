export const renewalNoteTarget = (id: string) => `renewal:${id}`;
export function visibleRenewalNotes<T extends {target?: string | null}>(notes: T[], scheduledIds: Set<string>): T[] {
  return notes.filter(note => !note.target?.startsWith("renewal:") || scheduledIds.has(note.target.slice(8)));
}
export async function loadVisibleRenewalNotes(client: any, organizationId: string, studentId: string, notes: any[]) {
  const ids = [...new Set(notes.filter(n => n.target?.startsWith("renewal:")).map(n => n.target.slice(8)))];
  if (!ids.length) return notes;
  const {data, error} = await client.from("student_enrollments").select("id,status").eq("organization_id", organizationId)
    .eq("student_id", studentId).in("id", ids);
  if (error) throw new Error("Yenileme notlarının dönem durumu okunamadı.");
  return visibleRenewalNotes(notes, new Set<string>((data || []).filter((e:any) => e.status === "scheduled").map((e:any) => e.id)));
}
export async function resolveStartedRenewalNotifications(client: any, organizationId: string) {
  const pending = await client.from("system_notifications").select("id,metadata").eq("organization_id", organizationId)
    .eq("notification_type", "registration_renewed").eq("is_read", false);
  if (pending.error) return;
  const ids = [...new Set<string>((pending.data || []).map((n:any) => n.metadata?.enrollment_id).filter(Boolean))];
  if (!ids.length) return;
  const periods = await client.from("student_enrollments").select("id,status").eq("organization_id", organizationId).in("id", ids);
  if (periods.error) return;
  const started = new Set((periods.data || []).filter((e:any) => ["active", "completed", "cancelled"].includes(e.status)).map((e:any) => e.id));
  const stale = (pending.data || []).filter((n:any) => started.has(n.metadata?.enrollment_id)).map((n:any) => n.id);
  if (stale.length) await client.from("system_notifications").update({is_read:true,read_at:new Date().toISOString()})
    .eq("organization_id", organizationId).in("id", stale);
}
