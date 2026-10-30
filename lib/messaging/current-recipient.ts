"use client";

export async function currentRecipient(studentId: string, previousRecipient?: string | null) {
  const response = await fetch("/api/student-message-recipient", {
    method:"POST", cache:"no-store", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({studentId,previousRecipient}),
  });
  const result = await response.json();
  if (!response.ok || !result.ok || !result.recipient) throw new Error(result.message || "Güncel telefon doğrulanamadı.");
  return String(result.recipient);
}

// Reserve the window within the click gesture (including on iPhone), then resolve the current phone.
export async function openCurrentWhatsapp(studentId: string, previousRecipient: string | null, message: string) {
  const popup = window.open("about:blank", "_blank");
  if (!popup) throw new Error("WhatsApp penceresi açılamadı. Açılır pencere iznini kontrol edin.");
  popup.opener = null;
  try {
    const recipient = await currentRecipient(studentId, previousRecipient);
    popup.location.href = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
    return recipient;
  } catch (error) { popup.close(); throw error; }
}
