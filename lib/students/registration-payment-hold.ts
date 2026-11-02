export function registrationPaymentHoldMessage(amount: number) {
  return `Önceki dönemden ${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL borç bulunmaktadır. Ödeme tamamlanmadan yeni kayıt, kayıt yenileme veya aktife alma yapılamaz.`;
}

export async function registrationPaymentDue(client: any, studentId: string): Promise<number> {
  const { data, error } = await client.rpc("student_registration_payment_due", { p_student_id: studentId });
  if (error) throw new Error("Önceki dönem ödeme kontrolü yapılamadı: " + error.message);
  return Math.max(0, Number(data || 0));
}
