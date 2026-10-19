export function guardianPaymentSummary(enrollment: any, coursePackage: any, payments: any[], plan?: any) {
  const paid = !enrollment?.id ? 0 : payments.filter(payment => payment.enrollment_id === enrollment?.id && ["recorded", "paid", "completed"].includes(String(payment.payment_status))).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const price = Number(plan?.total_amount ?? enrollment?.package_price ?? coursePackage?.price ?? 0);
  return { paid, price, debt: Math.max(0, price - paid) };
}
