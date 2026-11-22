type Obligation = {
  title?: string | null;
  obligation_type?: string | null;
  amount: number;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  status: string;
  due_date?: string | null;
};

export function openStudentObligations<T extends Obligation>(obligations: T[]) {
  return obligations.filter((item) =>
    !["paid", "cancelled", "canceled"].includes(String(item.status).toLowerCase()) &&
    !(item.obligation_type === "installment" &&
      String(item.title || "").toLocaleLowerCase("tr-TR").startsWith("paket ücreti")) &&
    remainingObligation(item) > 0,
  );
}

export function remainingObligation(item: Obligation) {
  return Math.max(0, Number(item.remaining_amount ?? Number(item.amount) - Number(item.paid_amount || 0)));
}

export function summarizeStudentDebt(
  enrollment: { remainingPayment: number; paymentDueDate: string | null } | null,
  obligations: Obligation[],
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()),
) {
  const packageDebt = enrollment?.remainingPayment ?? 0;
  const open = openStudentObligations(obligations);
  const extraDebt = open.reduce((sum, item) => sum + remainingObligation(item), 0);
  const dueDates = open.map((item) => item.due_date);
  if (packageDebt > 0) dueDates.push(enrollment?.paymentDueDate);
  const dueDate = dueDates.filter((date): date is string =>
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date),
  ).sort()[0] ?? null;
  return {
    packageDebt,
    extraDebt,
    totalDebt: Math.round((packageDebt + extraDebt) * 100) / 100,
    dueDate,
    overdue: Boolean(dueDate && dueDate < today),
  };
}
