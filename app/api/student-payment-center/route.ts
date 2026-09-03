import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;

function amount(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    const studentId = String(request.nextUrl.searchParams.get("studentId") || "");

    if (!organizationId || !studentId) {
      return NextResponse.json({ ok: false, error: "Öğrenci bilgisi eksik." }, { status: 400 });
    }

    const supabase = await createClient();

    const [studentResult, enrollmentResult, paymentsResult] = await Promise.all([
      supabase
        .from("students")
        .select("id,first_name,last_name")
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
        .select("*")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .order("received_at", { ascending: false })
        .limit(50),
    ]);

    if (studentResult.error) throw studentResult.error;
    if (enrollmentResult.error) throw enrollmentResult.error;
    if (paymentsResult.error) throw paymentsResult.error;
    if (!studentResult.data) {
      return NextResponse.json({ ok: false, error: "Öğrenci bulunamadı." }, { status: 404 });
    }

    const enrollment = enrollmentResult.data;
    let packageInfo: any = null;

    if (enrollment?.package_id) {
      const packageResult = await supabase
        .from("course_packages")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", enrollment.package_id)
        .maybeSingle();
      if (packageResult.error) throw packageResult.error;
      packageInfo = packageResult.data;
    }

    const allPayments = paymentsResult.data || [];
    const activePayments = enrollment?.id
      ? allPayments.filter((row: any) => row.enrollment_id === enrollment.id)
      : [];

    const totalReceived = activePayments.reduce((sum: number, row: any) => sum + amount(row.amount), 0);
    const totalAmount = amount(
      packageInfo?.price ??
        packageInfo?.amount ??
        packageInfo?.package_price ??
        packageInfo?.sale_price ??
        enrollment?.package_price ??
        0,
    );
    const remainingPayment = Math.max(0, totalAmount - totalReceived);

    return NextResponse.json({
      ok: true,
      student: studentResult.data,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            paymentDueDate: enrollment.payment_due_date || enrollment.start_date || null,
            packageName: packageInfo?.name || null,
            totalAmount,
            totalReceived,
            remainingPayment,
          }
        : null,
      payments: allPayments.map((row: any) => ({
        id: row.id,
        enrollmentId: row.enrollment_id || null,
        amount: amount(row.amount),
        method: row.payment_method || row.method || "other",
        description: row.description || row.note || null,
        receivedAt: row.received_at || row.created_at || null,
        status: row.status || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Ödeme bilgileri alınamadı." },
      { status: 500 },
    );
  }
}
