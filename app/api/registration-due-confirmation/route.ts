import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const roles = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  const profile = await requireProfile([...roles]);
  const studentId = request.nextUrl.searchParams.get("studentId") || "";
  if (!profile.organization_id || !studentId) {
    return NextResponse.json({ ok: false, confirmed: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("registration_completion_checklists")
    .select("payment_due_date,draft_data")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .maybeSingle();

  const draft = (data?.draft_data || {}) as Record<string, any>;
  const confirmation = draft.payment_due_confirmation || null;
  return NextResponse.json({
    ok: true,
    confirmed: Boolean(confirmation?.confirmed_at && confirmation?.date === data?.payment_due_date),
    date: data?.payment_due_date || null,
    confirmedAt: confirmation?.confirmed_at || null,
  });
}

export async function POST(request: NextRequest) {
  const profile = await requireProfile([...roles]);
  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();
  const dueDate = String(body.dueDate || "").trim();
  const note = String(body.note || "").trim();

  if (!profile.organization_id || !studentId || !validDate(dueDate)) {
    return NextResponse.json({ ok: false, message: "Geçerli öğrenci ve vade tarihi gereklidir." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id,first_name,last_name")
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ ok: false, message: "Öğrenci bulunamadı." }, { status: 404 });
  }

  const { data: checklist } = await supabase
    .from("registration_completion_checklists")
    .select("draft_data")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .maybeSingle();

  const now = new Date().toISOString();
  const draftData = {
    ...((checklist?.draft_data || {}) as Record<string, unknown>),
    payment_due_date: dueDate,
    payment_due_confirmation: {
      date: dueDate,
      confirmed_at: now,
      confirmed_by: profile.id,
    },
  };

  const { error: checklistError } = await supabase
    .from("registration_completion_checklists")
    .upsert(
      {
        organization_id: profile.organization_id,
        student_id: studentId,
        payment_due_date: dueDate,
        payment_note: note || null,
        draft_data: draftData,
        draft_saved_at: now,
        updated_by: profile.id,
        updated_at: now,
      },
      { onConflict: "student_id" },
    );

  if (checklistError) {
    return NextResponse.json({ ok: false, message: checklistError.message }, { status: 500 });
  }

  const { data: enrollment } = await supabase
    .from("student_enrollments")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enrollment?.id) {
    const { error: enrollmentError } = await supabase
      .from("student_enrollments")
      .update({ payment_due_date: dueDate })
      .eq("id", enrollment.id)
      .eq("organization_id", profile.organization_id);

    if (enrollmentError) {
      return NextResponse.json({ ok: false, message: enrollmentError.message }, { status: 500 });
    }
  }

  await supabase.from("student_activity_logs").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    activity_type: "payment_due_confirmed",
    title: "Ödeme vade tarihi onaylandı",
    description: `${dueDate} ödeme vade tarihi kesin kayıt ekranından onaylandı.${note ? ` Not: ${note}` : ""}`,
    source_type: "registration_completion",
    source_id: studentId,
    performed_by: profile.id,
    performed_at: now,
  });

  return NextResponse.json({ ok: true, date: dueDate, confirmedAt: now });
}
