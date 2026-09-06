import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { requireProfile } from "@/lib/auth/profile";

const ROLES = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;
const TYPES = new Set(["equipment", "service", "installment", "other"]);
const PAYMENT_METHODS = new Set(["cash", "card", "bank_transfer", "eft", "other"]);

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
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
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId || !profile.organization_id) {
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 400 });
    }
    const supabase = adminClient();
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
    return NextResponse.json({ error: "Borç kayıtları yüklenemedi." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const body = await request.json();
    const organizationId = profile.organization_id;
    const studentId = String(body.studentId || "");
    const title = String(body.title || "").trim().slice(0, 160);
    const dueDate = String(body.dueDate || "");
    const obligationAmount = amount(body.amount);
    const obligationType = TYPES.has(body.obligationType) ? body.obligationType : "other";

    if (!organizationId || !studentId || !title || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !obligationAmount) {
      return NextResponse.json(
        { error: "Öğrenci, açıklama, tutar ve geçerli vade tarihi zorunludur." },
        { status: 400 },
      );
    }

    const supabase = adminClient();
    const { data: student } = await supabase
      .from("students")
      .select("id,first_name,last_name")
      .eq("organization_id", organizationId)
      .eq("id", studentId)
      .maybeSingle();

    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const { data: obligation, error } = await supabase
      .from("student_financial_obligations")
      .insert({
        organization_id: organizationId,
        student_id: studentId,
        enrollment_id: body.enrollmentId || null,
        obligation_type: obligationType,
        title,
        description: String(body.description || "").trim().slice(0, 1000) || null,
        amount: obligationAmount,
        due_date: dueDate,
        reminder_days: Math.min(90, Math.max(0, Number(body.reminderDays) || 3)),
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error || !obligation) throw error || new Error("Borç kaydı oluşturulamadı.");

    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    await Promise.all([
      supabase.from("student_activity_logs").insert({
        organization_id: organizationId,
        student_id: studentId,
        activity_type: "financial_obligation_created",
        title: "Vadeli borç kaydı oluşturuldu",
        description: `${title} · ${obligationAmount} TL · Vade: ${dueDate}`,
        source_type: "student_financial_obligation",
        source_id: obligation.id,
        new_value: { obligation_id: obligation.id, due_date: dueDate, amount: obligationAmount },
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
        target_path: `/ogrenciler/${studentId}?payment=collect`,
        created_by: profile.id,
        metadata: { obligation_id: obligation.id },
      }),
    ]);

    return NextResponse.json({ ok: true, message: "Borç kaydı oluşturuldu ve vadeli takibe alındı." });
  } catch (error) {
    console.error("student obligations POST error", error);
    return NextResponse.json({ error: "Borç kaydı oluşturulamadı." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const body = await request.json();
    const organizationId = profile.organization_id;
    const obligationId = String(body.obligationId || "");
    const paidAmount = amount(body.paidAmount);
    const paymentMethod = PAYMENT_METHODS.has(body.paymentMethod) ? body.paymentMethod : "cash";

    if (!organizationId || !obligationId || !paidAmount) {
      return NextResponse.json({ error: "Geçerli tahsilat tutarı giriniz." }, { status: 400 });
    }

    const supabase = adminClient();
    const { data: current } = await supabase
      .from("student_financial_obligations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", obligationId)
      .maybeSingle();

    if (!current || ["paid", "cancelled"].includes(current.status)) {
      return NextResponse.json({ error: "Açık borç kaydı bulunamadı." }, { status: 404 });
    }

    const alreadyPaid = Number(current.paid_amount || 0);
    const remaining = Math.max(0, Number(current.amount) - alreadyPaid);
    if (paidAmount > remaining) {
      return NextResponse.json(
        { error: `Tahsilat kalan borçtan fazla olamaz. Kalan: ${remaining.toLocaleString("tr-TR")} TL` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const nextPaid = Math.round((alreadyPaid + paidAmount) * 100) / 100;
    const nextStatus = nextPaid >= Number(current.amount) ? "paid" : "partially_paid";
    const cashHandoverStatus = paymentMethod === "cash" ? "with_staff" : "main_cash_confirmed";

    const { data: payment, error: paymentError } = await supabase
      .from("student_payments")
      .insert({
        organization_id: organizationId,
        student_id: current.student_id,
        enrollment_id: current.enrollment_id || null,
        amount: paidAmount,
        currency: "TRY",
        payment_method: paymentMethod,
        payment_status: "received",
        description: `Ek borç tahsilatı · ${current.title}`,
        received_by: profile.id,
        received_at: now,
        cash_handover_status: cashHandoverStatus,
        cash_handover_requested_at: null,
        cash_handover_approved_by: null,
        cash_handover_approved_at: paymentMethod === "cash" ? null : now,
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: paymentError ? `Tahsilat ödeme merkezine yazılamadı: ${paymentError.message}` : "Tahsilat kaydedilemedi." },
        { status: 500 },
      );
    }

    const { error: obligationError } = await supabase
      .from("student_financial_obligations")
      .update({
        paid_amount: nextPaid,
        status: nextStatus,
        paid_by: profile.id,
        paid_at: nextStatus === "paid" ? now : null,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", obligationId);

    if (obligationError) {
      await supabase.from("student_payments").delete().eq("id", payment.id).eq("organization_id", organizationId);
      throw obligationError;
    }

    await Promise.all([
      supabase.from("student_activity_logs").insert({
        organization_id: organizationId,
        student_id: current.student_id,
        activity_type: "financial_obligation_payment",
        title: nextStatus === "paid" ? "Ek borç tamamen ödendi" : "Ek borca kısmi ödeme alındı",
        description: `${current.title} · ${paidAmount} TL tahsil edildi.`,
        source_type: "student_financial_obligation",
        source_id: obligationId,
        new_value: { obligation_id: obligationId, payment_id: payment.id, paid_amount: paidAmount, status: nextStatus },
        performed_at: now,
      }),
      supabase.from("system_notifications").insert({
        organization_id: organizationId,
        category: "finance",
        event_key: "financial_obligation_payment",
        title: nextStatus === "paid" ? "Borç kapatıldı" : "Kısmi tahsilat alındı",
        message: `${current.title} için ${paidAmount.toLocaleString("tr-TR")} TL ödeme alındı.`,
        severity: "success",
        entity_type: "student",
        entity_id: current.student_id,
        is_read: false,
        target_path: `/ogrenciler/${current.student_id}?payment=history`,
        created_by: profile.id,
        metadata: { obligation_id: obligationId, payment_id: payment.id },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      message:
        nextStatus === "paid"
          ? `Borç tamamen kapatıldı. ${paymentMethod === "cash" ? "Nakit kasa teslimi bekliyor." : "Ödeme merkeze işlendi."}`
          : `Kısmi ödeme kaydedildi. Kalan ${(Number(current.amount) - nextPaid).toLocaleString("tr-TR")} TL.`,
    });
  } catch (error) {
    console.error("student obligations PATCH error", error);
    return NextResponse.json({ error: "Tahsilat kaydedilemedi." }, { status: 500 });
  }
}
