import "server-only";
import { guardianPaymentReminder, isReceivedPayment } from "@/lib/guardian/payment-summary";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function amount(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadStudentObligations(organizationId: string, studentId: string) {
  const { data, error } = await adminClient()
    .from("student_financial_obligation_summary")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function loadStudentPaymentCenter(organizationId: string, studentId: string, requestedEnrollmentId = "", includeHistory = true) {
  // Yetki requireProfile ile doğrulandıktan sonra finans okumalarını service-role
  // üzerinden yapıyoruz. Tüm sorgular organization_id + student_id ile sınırlandırılır.
  // Böylece student_enrollments üzerindeki RLS farklılıkları finans merkezinde
  // yanlış ₺0 / Ödendi durumuna dönüşmez.
  const supabase = adminClient();

  const [studentResult, enrollmentResult, paymentsResult, checklistResult] = await Promise.all([
    supabase
      .from("students")
      .select("id,first_name,last_name,phone,guardian_name,guardian_phone,preferred_package_id")
      .eq("organization_id", organizationId)
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("student_enrollments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .in("status", ["active", "scheduled"])
      .order("created_at", { ascending: false }),
    includeHistory ? supabase
      .from("student_payments")
      .select(
        "id,organization_id,student_id,enrollment_id,amount,currency,payment_method,payment_status,description,received_at,created_at,cash_handover_status,cancelled_at",
      )
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .order("received_at", { ascending: false })
      .limit(100) : Promise.resolve({ data: [], error: null }),
    supabase
      .from("registration_completion_checklists")
      .select("enrollment_id,draft_data,payment_due_date")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  if (studentResult.error) throw studentResult.error;
  if (enrollmentResult.error) throw enrollmentResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (checklistResult.error) throw checklistResult.error;

  if (!studentResult.data) {
    return null;
  }

  const periods = enrollmentResult.data || [];
  const enrollment = requestedEnrollmentId
    ? periods.find((row: any) => row.id === requestedEnrollmentId)
    : periods.find((row: any) => row.status === "active") || periods[0] || null;
  if (requestedEnrollmentId && !enrollment) return null;
  const draftData =
    checklistResult.data?.draft_data && typeof checklistResult.data.draft_data === "object"
      ? (checklistResult.data.draft_data as Record<string, unknown>)
      : {};

  const resolvedPackageId = String(
    enrollment?.package_id ||
      draftData.package_id ||
      studentResult.data.preferred_package_id ||
      "",
  );

  let packageInfo: any = null;

  if (resolvedPackageId) {
    const packageResult = await supabase
      .from("course_packages")
      .select("id,name,price,lesson_count")
      .eq("organization_id", organizationId)
      .eq("id", resolvedPackageId)
      .maybeSingle();
    if (packageResult.error) throw packageResult.error;
    packageInfo = packageResult.data;
  }

  const allPayments = (paymentsResult.data || []).filter(
    (row: any) => !row.cancelled_at && row.payment_status !== "cancelled",
  );

  const historicalEnrollmentIds = [
    ...new Set(
      allPayments
        .map((row: any) => String(row.enrollment_id || ""))
        .filter(Boolean),
    ),
  ];

  const enrollmentPeriodMap = new Map<string, any>();
  if (historicalEnrollmentIds.length) {
    const { data: historyEnrollments, error: historyEnrollmentError } = await supabase
      .from("student_enrollments")
      .select("id,package_id,start_date,planned_end_date,total_lessons,status")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .in("id", historicalEnrollmentIds);

    if (historyEnrollmentError) throw historyEnrollmentError;

    const packageIds = [
      ...new Set(
        (historyEnrollments || [])
          .map((row: any) => String(row.package_id || ""))
          .filter(Boolean),
      ),
    ];

    const packageMap = new Map<string, any>();
    if (packageIds.length) {
      const { data: historyPackages } = await supabase
        .from("course_packages")
        .select("id,name,price,lesson_count")
        .eq("organization_id", organizationId)
        .in("id", packageIds);
      for (const item of historyPackages || []) packageMap.set(String(item.id), item);
    }

    for (const row of historyEnrollments || []) {
      enrollmentPeriodMap.set(String(row.id), {
        ...row,
        package: row.package_id ? packageMap.get(String(row.package_id)) || null : null,
      });
    }
  }

  const [links, plan, installments] = await Promise.all([
    supabase.from("student_activity_logs").select("new_value")
      .eq("organization_id", organizationId).eq("student_id", studentId)
      .eq("activity_type", "financial_obligation_payment"),
    enrollment ? supabase.from("student_payment_plans").select("id,total_amount,status")
      .eq("organization_id", organizationId).eq("student_id", studentId)
      .eq("enrollment_id", enrollment.id).maybeSingle() : { data: null, error: null },
    enrollment ? supabase.from("student_payment_installments").select("plan_id,due_date,amount,paid_amount,status")
      .eq("organization_id", organizationId).eq("student_id", studentId)
      .eq("enrollment_id", enrollment.id) : { data: [], error: null },
  ]);
  if (links.error) throw links.error;
  if (plan.error) throw plan.error;
  if (installments.error) throw installments.error;

  const extraPaymentIds = new Set((links.data || []).map((row) => row.new_value?.payment_id).filter(Boolean));
  let totalReceived = 0;
  if (enrollment) {
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from("student_payments")
        .select("id,amount,payment_status,cancelled_at")
        .eq("organization_id", organizationId).eq("student_id", studentId)
        .eq("enrollment_id", enrollment.id).order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      for (const row of data ?? []) {
        if (!row.cancelled_at && !extraPaymentIds.has(row.id) && isReceivedPayment(row.payment_status)) {
          totalReceived += amount(row.amount);
        }
      }
      if ((data?.length ?? 0) < pageSize) break;
    }
  }

  const activePlan = plan.data?.status === "cancelled" ? null : plan.data;
  const totalAmount = amount(activePlan?.total_amount ?? enrollment?.package_price ?? packageInfo?.price);
  const remainingPayment = Math.max(0, Math.round((totalAmount - totalReceived) * 100) / 100);
  const currentInstallments = (installments.data ?? []).filter((row) => row.plan_id === activePlan?.id);
  const nextDueDate = guardianPaymentReminder(enrollment, remainingPayment, currentInstallments, activePlan)?.dueDate;

  const draftStartDate = String(draftData.start_date || "") || null;
  const draftPlannedEndDate = String(draftData.planned_end_date || "") || null;
  const draftTotalLessons = Number(draftData.total_lessons || 0);
  const hasFinancePreview = Boolean(enrollment || packageInfo);

  return {
    ok: true,
    student: studentResult.data,
    periods: periods.map((row: any) => ({id:row.id,status:row.status,startDate:row.start_date,plannedEndDate:row.planned_end_date})),
    enrollment: hasFinancePreview
      ? {
          id: enrollment?.id || "",
          source: enrollment ? enrollment.status : "registration_draft",
          startDate: enrollment?.start_date || draftStartDate,
          plannedEndDate: enrollment?.planned_end_date || draftPlannedEndDate,
          paymentDueDate:
            nextDueDate ||
            enrollment?.payment_due_date ||
            checklistResult.data?.payment_due_date ||
            draftStartDate ||
            null,
          packageName: packageInfo?.name || null,
          lessonCount: Number(
            enrollment?.total_lessons || draftTotalLessons || packageInfo?.lesson_count || 0,
          ),
          totalAmount,
          totalReceived,
          remainingPayment,
        }
      : null,
    payments: allPayments.map((row: any) => {
      const period = row.enrollment_id
        ? enrollmentPeriodMap.get(String(row.enrollment_id)) || null
        : null;
      return {
        id: row.id,
        enrollmentId: row.enrollment_id || null,
        isObligationPayment:extraPaymentIds.has(row.id),
        amount: amount(row.amount),
        method: row.payment_method || "other",
        description: row.description || null,
        receivedAt: row.received_at || row.created_at || null,
        status: row.payment_status || "received",
        cashHandoverStatus: row.cash_handover_status || null,
        periodStartDate: period?.start_date || null,
        periodEndDate: period?.planned_end_date || null,
        packageName: period?.package?.name || null,
        packagePrice: amount(period?.package?.price),
      };
    }),
  };
}
