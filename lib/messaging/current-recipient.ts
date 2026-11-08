"use client";

export async function currentRecipient(studentId: string, previousRecipient?: string | null) {
  const response = await fetch("/api/student-message-recipient", {
    method:"POST", cache:"no-store", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({studentId,previousRecipient}),
  });
  if (response.redirected) throw new Error("Oturumunuz sona ermiş olabilir. SprintOS’a yeniden giriş yapın.");
  const result = await response.json().catch(() => { throw new Error("Telefon bilgisi alınamadı. Sayfayı yenileyip tekrar deneyin."); });
  if (!response.ok || !result.ok || !result.recipient) throw new Error(result.message || "Güncel telefon doğrulanamadı.");
  return String(result.recipient);
}

// Reserve the window within the click gesture (including on iPhone), then resolve the current phone.
export async function openCurrentWhatsapp(studentId: string, previousRecipient: string | null, message: string) {
  const popup = window.open("about:blank", "_blank");
  if (popup) popup.opener = null;
  try {
    const recipient = await currentRecipient(studentId, previousRecipient);
    navigateWhatsapp(popup, `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`);
    return recipient;
  } catch (error) { popup?.close(); throw error; }
}

// Call only with a verified WhatsApp destination. Used by explicit queues too.
export function navigateWhatsapp(popup: Window | null, url: string) {
  if (!popup || popup.closed) { window.location.assign(url); return; }
  try { popup.location.href = url; }
  catch { popup.close(); window.location.assign(url); }
}
