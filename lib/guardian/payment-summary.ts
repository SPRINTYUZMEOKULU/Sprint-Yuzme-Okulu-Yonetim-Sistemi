export function isReceivedPayment(status: unknown) {
  return ["received", "recorded", "paid", "completed"].includes(String(status));
}

export function guardianPaymentSummary(enrollment: any, coursePackage: any, payments: any[], plan?: any) {
  const paid = !enrollment?.id ? 0 : payments.filter(payment => payment.enrollment_id === enrollment?.id && !payment.is_obligation_payment && !payment.cancelled_at && isReceivedPayment(payment.payment_status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const price = Number((plan?.status !== "cancelled" ? plan?.total_amount : undefined) ?? enrollment?.package_price ?? coursePackage?.price ?? 0);
  return { paid, price, debt: Math.max(0, price - paid), excess: Math.max(0, paid - price) };
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

export function paymentPresentation(status:unknown){
 const value=String(status||'');
 if(isReceivedPayment(value))return {label:'Alındı',tone:'green'};
 if(['cancelled','canceled','void'].includes(value))return {label:'İptal edildi',tone:'gray'};
 if(['refunded','refund'].includes(value))return {label:'İade edildi',tone:'orange'};
 if(['pending','awaiting','unpaid'].includes(value))return {label:'Bekleniyor',tone:'blue'};
 if(['failed','rejected'].includes(value))return {label:'Başarısız',tone:'red'};
 return {label:'Durum kontrol edilmeli',tone:'gray'};
}
export function installmentPresentation(item:any,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
 const remaining=Math.max(0,Number(item.amount||0)-Number(item.paid_amount||0));
 if(['cancelled','canceled'].includes(item.status))return {remaining:0,label:'İptal edildi',tone:'gray'};
 if(remaining===0)return {remaining,label:'Ödendi',tone:'green'};
 if(item.due_date&&item.due_date<today)return {remaining,label:'Gecikti',tone:'red'};
 return {remaining,label:Number(item.paid_amount||0)>0?'Kısmi ödeme':item.due_date===today?'Bugün ödenecek':'Bekliyor',tone:item.due_date===today?'orange':'blue'};
}

export function guardianObligationSummary(obligations:any[]=[]){
 const rows=obligations.filter(row=>!['cancelled','canceled'].includes(String(row.status))&&!(row.obligation_type==='installment'&&String(row.title||'').toLocaleLowerCase('tr-TR').startsWith('paket ücreti')));
 const open=rows.filter(row=>Number(row.amount)>Number(row.paid_amount||0)&&row.status!=='paid');
 const debt=open.reduce((sum,row)=>sum+Math.max(0,Number(row.amount||0)-Number(row.paid_amount||0)),0);
 return {rows,open,debt};
}
export function guardianCombinedReminder(enrollment:any,packageDebt:number,installments:any[],plan:any,obligations:any[]=[],today?:string):GuardianPaymentReminder|null{
 const course=guardianPaymentReminder(enrollment,packageDebt,installments,plan,today);
 const extra=guardianObligationSummary(obligations);
 const day=today||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());
 const candidates=[...(course?[course]:[]),...extra.open.map(row=>({dueDate:row.due_date||null,amount:Math.max(0,Number(row.amount)-Number(row.paid_amount||0))}))].sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
 if(!candidates.length)return null;
 const next=candidates[0],dueDate=next.dueDate;
 return {dueDate,amount:next.amount,debt:packageDebt+extra.debt,state:!dueDate?'unscheduled':dueDate<day?'overdue':dueDate===day?'today':'upcoming',day};
}
