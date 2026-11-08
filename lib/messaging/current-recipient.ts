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
    const url = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
    // Mobile browsers/PWAs can block or close a reserved tab. Navigate the
    // current tab only after the saved recipient has been verified.
    if (!popup || popup.closed) window.location.assign(url);
    else {
      try { popup.location.href = url; }
      catch { popup.close(); window.location.assign(url); }
    }
    return recipient;
  } catch (error) { popup?.close(); throw error; }
}
