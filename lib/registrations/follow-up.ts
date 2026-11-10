export const CONTACT_LABELS: Record<string, string> = {
  call_me: "Aranmak istiyor", whatsapp_info: "WhatsApp üzerinden bilgi istiyor",
  need_information: "Detaylı bilgi istiyor",
};
export function contactNeedsFollowUp(value?: string | null) {
  return Boolean(value && CONTACT_LABELS[value]);
}
export function contactResolved(consent: {contact_request?: string | null; accepted_at?: string | null} | null | undefined, logs: {new_value?: unknown; performed_at?: string | null}[]) {
  if (!contactNeedsFollowUp(consent?.contact_request)) return true;
  return logs.some(log => {
    const value = log.new_value as Record<string, unknown> | null;
    return value?.contact_request === consent?.contact_request &&
      value?.consent_accepted_at === consent?.accepted_at &&
      typeof value?.resolution === "string" && value.resolution.trim().length >= 5;
  });
}
export const TRIAL_STATUS: Record<string, string> = {
  planned: "Planlandı", attended: "Katıldı", absent: "Gelmedi", cancelled: "İptal edildi",
};
