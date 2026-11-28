import { NextRequest, NextResponse } from "next/server";
import { loadStudentPaymentCenter } from "@/lib/payments/student-finance";

import { requireProfile } from "@/lib/auth/profile";

const ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
] as const;

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    const studentId = String(request.nextUrl.searchParams.get("studentId") || "");
    const requestedEnrollmentId = String(request.nextUrl.searchParams.get("enrollmentId") || "");

    if (!organizationId || !studentId) {
      return NextResponse.json(
        { ok: false, error: "Öğrenci bilgisi eksik." },
        { status: 400 },
      );
    }

    const includeCorrections = request.nextUrl.searchParams.get("includeCorrections") === "1";
    const result = await loadStudentPaymentCenter(organizationId, studentId, requestedEnrollmentId, true, includeCorrections);
    if (!result) {
      return NextResponse.json({ ok: false, error: requestedEnrollmentId ? "Seçilen ödeme dönemi bulunamadı." : "Öğrenci bulunamadı." }, { status: 404 });
    }
    if (!includeCorrections) return NextResponse.json(result);
    const { can, getPermissionSnapshot } = await import("@/lib/auth/permissions");
    const permissions = await getPermissionSnapshot({ userId: profile.id, organizationId, baseRole: profile.role });
    const financeRole = ["owner", "admin", "accounting"].includes(profile.role);
    return NextResponse.json({
      ...result,
      correctionPermissions: {
        edit: financeRole || can(permissions, "finance.payment_edit"),
        cancel: financeRole || can(permissions, "finance.payment_cancel"),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Ödeme bilgileri alınamadı." },
      { status: 500 },
    );
  }
}
