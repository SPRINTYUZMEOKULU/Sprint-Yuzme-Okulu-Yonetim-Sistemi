import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { requireProfile } from "@/lib/auth/profile";

const ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
] as const;

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

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    const studentId = String(request.nextUrl.searchParams.get("studentId") || "");

    if (!organizationId || !studentId) {
      return NextResponse.json(
        { ok: false, error: "Öğrenci bilgisi eksik." },
        { status: 400 },
      );
    }

    // Yetki requireProfile ile doğrulandıktan sonra finans okumalarını service-role
    // üzerinden yapıyoruz. Tüm sorgular organization_id + student_id ile sınırlandırılır.
    // Böylece student_enrollments üzerindeki RLS farklılıkları finans merkezinde
    // yanlış ₺0 / Ödendi durumuna dönüşmez.
    const supabase = adminClient();

    const [studentResult, enrollmentResult, paymentsResult] = await Promise.all([
      supabase
        .from("students")
        .select("id,first_name,last_name,phone,guardian_name,guardian_phone")
        .eq("organization_id", organizationId)
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("student_enrollments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("student_payments")
        .select(
          "id,organization_id,student_id,enrollment_id,amount,currency,payment_method,payment_status,description,received_at,created_at,cash_handover_status,cancelled_at",
        )
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .order("received_at", { ascending: false })
        .limit(100),
    ]);

    if (studentResult.error) throw studentResult.error;
    if (enrollmentResult.error) throw enrollmentResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    if (!studentResult.data) {
      return NextResponse.json(
        { ok: false, error: "Öğrenci bulunamadı." },
        { status: 404 },
      );
    }

    const enrollment = enrollmentResult.data;
    let packageInfo: any = null;

    if (enrollment?.package_id) {
      const packageResult = await supabase
        .from("course_packages")
        .select("id,name,price,lesson_count")
        .eq("organization_id", organizationId)
        .eq("id", enrollment.package_id)
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

    const activePayments = enrollment?.id
      ? allPayments.filter((row: any) => row.enrollment_id === enrollment.id)
      : [];

    const totalReceived = activePayments.reduce(
      (sum: number, row: any) => sum + amount(row.amount),
      0,
    );

    const totalAmount = amount(packageInfo?.price ?? enrollment?.package_price ?? 0);
    const remainingPayment = Math.max(0, totalAmount - totalReceived);

    return NextResponse.json({
      ok: true,
      student: studentResult.data,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            startDate: enrollment.start_date || null,
            plannedEndDate: enrollment.planned_end_date || null,
            paymentDueDate: enrollment.payment_due_date || enrollment.start_date || null,
            packageName: packageInfo?.name || null,
            lessonCount: Number(enrollment.total_lessons || packageInfo?.lesson_count || 0),
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
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Ödeme bilgileri alınamadı." },
      { status: 500 },
    );
  }
}
