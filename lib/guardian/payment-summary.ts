export function isReceivedPayment(status: unknown) {
  return ["received", "recorded", "paid", "completed"].includes(String(status));
}

export function guardianPaymentSummary(enrollment: any, coursePackage: any, payments: any[], plan?: any) {
  const paid = !enrollment?.id ? 0 : payments.filter(payment => payment.enrollment_id === enrollment?.id && isReceivedPayment(payment.payment_status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const price = Number((plan?.status !== "cancelled" ? plan?.total_amount : undefined) ?? enrollment?.package_price ?? coursePackage?.price ?? 0);
  return { paid, price, debt: Math.max(0, price - paid) };
}


export type GuardianPaymentReminder = { dueDate: string | null; amount: number; debt: number; state: "overdue" | "today" | "upcoming" | "unscheduled"; day: string };

export function guardianPaymentReminder(enrollment: any, debt: number, installments: any[], plan: any, today = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date())): GuardianPaymentReminder | null {
  if (!enrollment?.id || !Number.isFinite(debt) || debt <= 0) return null;
  const unpaid = plan && plan.status !== "cancelled" ? installments.filter(item => !["paid", "cancelled"].includes(item.status) && Number(item.amount) > Number(item.paid_amount || 0)).sort((a,b) => String(a.due_date).localeCompare(String(b.due_date))) : [];
  const next = unpaid[0];
  const value = next?.due_date || enrollment.payment_due_date;
  const dueDate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  return { dueDate, amount: next ? Math.min(debt, Math.max(0, Number(next.amount) - Number(next.paid_amount || 0))) : debt, debt, state: !dueDate ? "unscheduled" : dueDate < today ? "overdue" : dueDate === today ? "today" : "upcoming", day: today };
}
