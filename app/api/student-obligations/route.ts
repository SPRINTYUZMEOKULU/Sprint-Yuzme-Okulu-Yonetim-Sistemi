import { notifyGuardianFinance } from "@/lib/guardian/finance-notifications";
import { revalidateStudentSurfaces } from "@/lib/students/revalidate";
import { publishEventNotification } from "@/lib/notifications/publish-event";
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

    if(body.enrollmentId){
      const {data:enrollment,error:enrollmentError}=await supabase.from("student_enrollments").select("id").eq("organization_id",organizationId).eq("student_id",studentId).eq("id",body.enrollmentId).maybeSingle();
      if(enrollmentError||!enrollment)return NextResponse.json({error:"Borç için seçilen kayıt dönemi bu kursiyere ait değil."},{status:400});
    }
    const parsedDate=new Date(dueDate+"T12:00:00Z");
    if(Number.isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==dueDate)return NextResponse.json({error:"Geçerli bir vade tarihi seçin."},{status:400});
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
        reminder_days: Math.min(90, Math.max(0, Number.isFinite(Number(body.reminderDays)) ? Number(body.reminderDays) : 3)),
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
      publishEventNotification({
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

    revalidateStudentSurfaces(studentId);
    let warning="";
    try{await notifyGuardianFinance(organizationId,studentId,obligation.id,"Yeni borç bilgisi",`${title}: ${obligationAmount.toLocaleString("tr-TR")} TL. Vade: ${dueDate}. Ayrıntıları Ödemeler bölümünden inceleyebilirsiniz.`,profile.id);}catch{warning=" Borç kaydedildi; veli bildirimi hazırlanamadı. Veli panelindeki güncel borç bilgisi korunur.";}
    return NextResponse.json({ ok: true, message: "Borç kaydı oluşturuldu ve vadeli takibe alındı."+warning });
  } catch (error) {
    console.error("student obligations POST error", error);
    return NextResponse.json({ error: "Borç kaydı oluşturulamadı." }, { status: 500 });
  }
}

export async function PATCH(request:NextRequest){
 try{
  const profile=await requireProfile([...ROLES]);const body=await request.json();
  const paidAmount=amount(body.paidAmount),obligationId=String(body.obligationId||"");
  if(!profile.organization_id||!paidAmount||!obligationId)return NextResponse.json({error:"Borç ve geçerli tahsilat tutarı girin."},{status:400});
  const {data,error}=await adminClient().rpc("collect_student_obligation",{p_actor:profile.id,p_obligation:obligationId,p_amount:paidAmount,p_method:PAYMENT_METHODS.has(body.paymentMethod)?body.paymentMethod:"cash",p_request:typeof body.requestId==="string"?body.requestId:null});
  if(error||!data)return NextResponse.json({error:error?.message||"Tahsilat doğrulanamadı."},{status:409});
  revalidateStudentSurfaces(data.student_id);
  let warning="";
  if(!data.duplicate){try{await notifyGuardianFinance(profile.organization_id,data.student_id,data.payment_id,"Ödemeniz kaydedildi",`${data.title}: ${paidAmount.toLocaleString("tr-TR")} TL ödeme alındı. Kalan: ${Number(data.remaining).toLocaleString("tr-TR")} TL.`,profile.id,"guardian_obligation_payment");}catch{warning=" Tahsilat kaydedildi; veli bildirimi hazırlanamadı.";}}
  return NextResponse.json({ok:true,paymentId:data.payment_id,message:(data.duplicate?"Bu tahsilat zaten kayıtlı.":data.status==="paid"?"Ek borç tamamen kapatıldı.":`Kısmi ödeme kaydedildi. Kalan ${Number(data.remaining).toLocaleString("tr-TR")} TL.`)+warning});
 }catch{return NextResponse.json({error:"Tahsilat sonucu doğrulanamadı. Yeniden denemeden önce ödeme geçmişini kontrol edin."},{status:500});}
}

export async function DELETE(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const body = await request.json();
    const organizationId = profile.organization_id;
    const obligationId = String(body.obligationId || "");
    const cancellationReason = String(body.reason || "Yanlışlıkla oluşturuldu")
      .trim()
      .slice(0, 500);

    if (!organizationId || !obligationId) {
      return NextResponse.json({ error: "İptal edilecek ek borç bulunamadı." }, { status: 400 });
    }

    const supabase = adminClient();
    const { data: current, error: currentError } = await supabase
      .from("student_financial_obligations")
      .select("id,student_id,title,description,amount,paid_amount,due_date,status")
      .eq("organization_id", organizationId)
      .eq("id", obligationId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      return NextResponse.json({ error: "Ek borç kaydı bulunamadı." }, { status: 404 });
    }
    if (current.status !== "open" || Number(current.paid_amount || 0) > 0) {
      return NextResponse.json(
        { error: "Ödeme alınmış veya kapanmış bir ek borç iptal edilemez." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const { data: cancelled, error: cancelError } = await supabase
      .from("student_financial_obligations")
      .update({ status: "cancelled", updated_at: now })
      .eq("organization_id", organizationId)
      .eq("id", obligationId)
      .eq("status", "open")
      .eq("paid_amount", 0)
      .select("id")
      .maybeSingle();

    if (cancelError) throw cancelError;
    if (!cancelled) {
      return NextResponse.json(
        { error: "Ek borç başka bir işlemle değişti. Sayfayı yenileyip tekrar deneyiniz." },
        { status: 409 },
      );
    }

    await supabase.from("student_activity_logs").insert({
      organization_id: organizationId,
      student_id: current.student_id,
      activity_type: "financial_obligation_cancelled",
      title: "Ek borç iptal edildi",
      description: `${current.title} · ${Number(current.amount).toLocaleString("tr-TR")} TL · ${cancellationReason}`,
      source_type: "student_financial_obligation",
      source_id: obligationId,
      old_value: {
        status: current.status,
        amount: current.amount,
        paid_amount: current.paid_amount,
        due_date: current.due_date,
        description: current.description,
      },
      new_value: {
        status: "cancelled",
        reason: cancellationReason,
      },
      performed_by: profile.id,
      performed_at: now,
    });

    revalidateStudentSurfaces(current.student_id);
    try{await notifyGuardianFinance(organizationId,current.student_id,obligationId,"Borç bilgisi güncellendi",`${current.title} başlıklı ek borç iptal edildi. Güncel tutarı Ödemeler bölümünden inceleyebilirsiniz.`,profile.id,"guardian_obligation_cancelled");}catch{/* Cancellation is saved; the portal reads the current row directly. */}
    return NextResponse.json({
      ok: true,
      message: "Ek borç iptal edildi ve toplam borç yeniden hesaplandı.",
    });
  } catch (error) {
    console.error("student obligations DELETE error", error);
    return NextResponse.json({ error: "Ek borç iptal edilemedi." }, { status: 500 });
  }
}
