export const REGISTRATION_MESSAGE_KEYS=["registration","registration_completed","welcome"];
type Message={template_key?:string;status?:string;sent_at?:string|null;message_body?:string|null;metadata?:Record<string,unknown>|null};
export function confirmedRegistrationMessage<T extends Message>(rows:T[],studentId:string):T|null {
  return rows.filter(row=>REGISTRATION_MESSAGE_KEYS.includes(row.template_key || "") && row.status === "sent" && Boolean(row.message_body?.trim()) && row.metadata?.source_path === `/kayit-tamamlama/${studentId}` && row.metadata?.delivery_confirmation === "manual_confirmed").sort((a,b)=>(Date.parse(b.sent_at || "")||0)-(Date.parse(a.sent_at || "")||0))[0] || null;
}
