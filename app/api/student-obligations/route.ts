import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
] as const;

const TYPES = new Set(["equipment", "service", "installment", "other"]);

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed * 100) / 100
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const studentId = request.nextUrl.searchParams.get("studentId");

    if (!studentId || !profile.organization_id) {
      return NextResponse.json(
        { error: "Öğrenci bulunamadı." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("student_financial_obligation_summary")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("student_id", studentId)
      .order("due_date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ obligations: data || [] });
  } catch (error) {
    console.error("student obligations GET error", error);
    return NextResponse.json(
      { error: "Borç kayıtları yüklenemedi." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const body = await request.json();
    const organizationId = profile.organization_id;
    const studentId = String(body.studentId || "");
    const title = String(body.title || "")
      .trim()
      .slice(0, 160);
    const dueDate = String(body.dueDate || "");
    const obligationAmount = amount(body.amount);
    const obligationType = TYPES.has(body.obligationType)
      ? body.obligationType
      : "other";

    if (
      !organizationId ||
      !studentId ||
      !title ||
      !dueDate ||
      !obligationAmount
    ) {
      return NextResponse.json(
        { error: "Öğrenci, açıklama, tutar ve vade tarihi zorunludur." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: student } = await supabase
      .from("students")
      .select("id,first_name,last_name")
      .eq("organization_id", organizationId)
      .eq("id", studentId)
      .maybeSingle();

    if (!student) {
      return NextResponse.json(
        { error: "Öğrenci bulunamadı." },
        { status: 404 },
      );
    }

    const { data: obligation, error } = await supabase
      .from("student_financial_obligations")
      .insert({
        organization_id: organizationId,
        student_id: studentId,
        enrollment_id: body.enrollmentId || null,
        obligation_type: obligationType,
        title,
        description:
          String(body.description || "")
            .trim()
            .slice(0, 1000) || null,
        amount: obligationAmount,
        due_date: dueDate,
        reminder_days: Math.min(
          90,
          Math.max(0, Number(body.reminderDays) || 3),
        ),
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (error) throw error;

    const studentName =
      `${student.first_name || ""} ${student.last_name || ""}`.trim();

    await Promise.all([
      supabase.from("student_activity_logs").insert({
        organization_id: organizationId,
        student_id: studentId,
        activity_type: "financial_obligation_created",
        title: "Vadeli borç kaydı oluşturuldu",
        description: `${title} · ${obligationAmount} TL · Vade: ${dueDate}`,
        source_type: "student_financial_obligation",
        source_id: obligation.id,
        new_value: { obligation_id: obligation.id, due_date: dueDate },
        performed_at: new Date().toISOString(),
      }),
      supabase.from("system_notifications").insert({
        organization_id: organizationId,
        category: "finance",
        event_key: "student_obligation_created",
        title: "Yeni vadeli öğrenci borcu",
        message: `${studentName}: ${title} için ${obligationAmount} TL borç kaydı oluşturuldu. Vade: ${dueDate}`,
        severity: "info",
        entity_type: "student",
        entity_id: studentId,
        is_read: false,
        target_path: `/ogrenciler/${studentId}#ek-borclar`,
        created_by: profile.id,
        metadata: { obligation_id: obligation.id },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Borç kaydı oluşturuldu ve takibe alındı.",
    });
  } catch (error) {
    console.error("student obligations POST error", error);
    return NextResponse.json(
      { error: "Borç kaydı oluşturulamadı." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const body = await request.json();
    const organizationId = profile.organization_id;
    const obligationId = String(body.obligationId || "");
    const paidAmount = amount(body.paidAmount);

    if (!organizationId || !obligationId || !paidAmount) {
      return NextResponse.json(
        { error: "Geçerli tahsilat tutarı giriniz." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: current } = await supabase
      .from("student_financial_obligations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", obligationId)
      .maybeSingle();

    if (!current || ["paid", "cancelled"].includes(current.status)) {
      return NextResponse.json(
        { error: "Açık borç kaydı bulunamadı." },
        { status: 404 },
      );
    }

    const nextPaid = Math.min(
      Number(current.amount),
      Number(current.paid_amount || 0) + paidAmount,
    );
    const nextStatus =
      nextPaid >= Number(current.amount) ? "paid" : "partially_paid";

    const { error } = await supabase
      .from("student_financial_obligations")
      .update({
        paid_amount: nextPaid,
        status: nextStatus,
        paid_by: profile.id,
        paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", obligationId);

    if (error) throw error;

    await supabase.from("student_activity_logs").insert({
      organization_id: organizationId,
      student_id: current.student_id,
      activity_type: "financial_obligation_payment",
      title:
        nextStatus === "paid"
          ? "Ek borç tamamen ödendi"
          : "Ek borca kısmi ödeme alındı",
      description: `${current.title} · ${paidAmount} TL tahsil edildi.`,
      source_type: "student_financial_obligation",
      source_id: obligationId,
      new_value: { obligation_id: obligationId, paid_amount: paidAmount },
      performed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message:
        nextStatus === "paid"
          ? "Borç tamamen kapatıldı."
          : "Kısmi ödeme kaydedildi.",
    });
  } catch (error) {
    console.error("student obligations PATCH error", error);
    return NextResponse.json(
      { error: "Tahsilat kaydedilemedi." },
      { status: 500 },
    );
  }
}
