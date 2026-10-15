import { SPRINT_MESSAGE_TEMPLATES, type SprintMessageTemplate } from "./sprint-message-catalog";
export async function loadMessageTemplates(db: any, organizationId: string): Promise<SprintMessageTemplate[]> {
  const { data, error } = await db.from("message_templates").select("template_key,title,body").eq("organization_id", organizationId).eq("is_active", true);
  if (error) throw Error("Mesaj şablonları yüklenemedi.");
  const rows = new Map<string, any>((data || []).map((r: any) => [r.template_key, r]));
  return SPRINT_MESSAGE_TEMPLATES.map(template => { const row = rows.get(template.key === "registration" ? "registration_completed" : template.key); return row ? { ...template, title: row.title, body: row.body } : template; });
}
