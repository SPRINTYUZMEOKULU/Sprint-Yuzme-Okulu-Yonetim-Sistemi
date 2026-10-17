export type CancellationSummary = {
  studentIds: string[]; plannedStudentIds: string[]; reservedStudentIds: string[];
  sentStudentIds: string[]; preparedStudentIds: string[]; openedStudentIds?: string[]; reasons: string[];
};
// Only completed operations cancel attendance. Message drafts alone are not an operation.
export function cancellationSummary(scheduleId: string, date: string, activities: any[], messages: any[]): CancellationSummary {
  const operations = new Map<string, any>();
  for (const row of activities) {
    if (row.source_id !== scheduleId || row.old_value?.cancelled_lesson_date !== date || !row.student_id) continue;
    const previous = operations.get(row.student_id);
    if (!previous || String(row.performed_at || '') >= String(previous.performed_at || '')) operations.set(row.student_id, row);
  }
  const sent = new Set<string>(), prepared = new Set<string>(), opened = new Set<string>();
  for (const row of messages) {
    if (row.metadata?.source_schedule_id !== scheduleId || row.metadata?.cancelled_date !== date || !row.student_id) continue;
    if (row.metadata?.delivery_confirmation === 'whatsapp_opened') opened.add(row.student_id);
    else if (['sent','delivered','read'].includes(row.status)) sent.add(row.student_id);
    else if (row.status === 'prepared') prepared.add(row.student_id);
  }
  for (const id of sent) prepared.delete(id);
  const rows = [...operations.values()];
  return {
    studentIds: [...operations.keys()],
    plannedStudentIds: rows.filter(row => row.new_value?.compensation_date).map(row => row.student_id),
    reservedStudentIds: rows.filter(row => !row.new_value?.compensation_date).map(row => row.student_id),
    sentStudentIds: [...sent], preparedStudentIds: [...prepared].filter(id=>!opened.has(id)), openedStudentIds: [...opened].filter(id=>!sent.has(id)),
    reasons: [...new Set<string>(rows.map(row => String(row.new_value?.reason || '')).filter(Boolean))],
  };
}
export function mergeCancellations(rows: CancellationSummary[]) {
  const union = (key: keyof CancellationSummary) => [...new Set(rows.flatMap(row => row[key] || []))];
  const sentStudentIds = union('sentStudentIds');
  return {studentIds:union('studentIds'),plannedStudentIds:union('plannedStudentIds'),reservedStudentIds:union('reservedStudentIds'),sentStudentIds,
    openedStudentIds:union('openedStudentIds').filter(id=>!sentStudentIds.includes(id)),preparedStudentIds:union('preparedStudentIds').filter(id=>!sentStudentIds.includes(id)&&!union('openedStudentIds').includes(id)),reasons:union('reasons')};
}

// Legacy capture removed emoji and classified cancellation text as registration updates.
// Match the complete normalized body and student; never infer delivery from opening WhatsApp.
export function reconcileCancellationMessages(messages: any[], captures: any[]) {
  const normalize = (value: unknown) => String(value || '').replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, '');
  const captured = new Set(captures.filter(row=>row.metadata?.source==='global_whatsapp_capture' && row.metadata?.delivery_confirmation==='whatsapp_opened' && row.metadata?.source_path==='/ders-operasyonlari').map(row=>JSON.stringify([row.student_id,normalize(row.message_body)])));
  return messages.map(row=>row.status==='prepared' && captured.has(JSON.stringify([row.student_id,normalize(row.message_body)]))
    ? {...row,metadata:{...row.metadata,delivery_confirmation:'whatsapp_opened'}} : row);
}
export function cancellationMessageLabel(summary: CancellationSummary, available = true) {
  if (!available) return 'Mesaj durumu yüklenemedi';
  const parts: string[] = [];
  if(summary.sentStudentIds.length) parts.push(`İptal mesajı gönderildi · ${summary.sentStudentIds.length} kursiyer`);
  if(summary.openedStudentIds?.length) parts.push(`WhatsApp açıldı · ${summary.openedStudentIds.length} kursiyer · Gönderim onayı bekleniyor`);
  if(summary.preparedStudentIds.length) parts.push(`Mesaj hazır · ${summary.preparedStudentIds.length} kursiyer`);
  return parts.join(' / ') || 'Mesaj kaydı bulunmuyor';
}
