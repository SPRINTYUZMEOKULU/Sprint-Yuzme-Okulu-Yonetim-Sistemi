type CashNotification = {
  event_key?: string | null;
  notification_type?: string | null;
  entity_id?: string | null;
  source_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Route cash events by payment identity, including notifications saved before this fix. */
export function cashNotificationTarget(row: CashNotification): string | null {
  const event = row.event_key || row.notification_type;
  const isHandover = event === "cash_handover_requested" || event === "cash_handover_approved";
  const isCashReceipt = event === "payment_received" && row.metadata?.payment_method === "cash";
  if (!isHandover && !isCashReceipt) return null;
  const id = row.metadata?.payment_id || row.entity_id || row.source_id;
  if (typeof id === "string" && id) return `/kasa?paymentId=${encodeURIComponent(id)}`;
  return event === "cash_handover_requested" ? "/kasa?durum=handoff_pending" : "/kasa";
}
