import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function todayTR() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00+03:00`).getTime()); }
function cleanPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}
function trDate(value?: string | null) {
  if (!value) return "-";
  const [y,m,d] = value.split("-");
  return y && m && d ? `${d}.${m}.${y}` : value;
}

export async function POST(request: Request) {
  try {
    const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
    const organizationId = profile.organization_id;
    const body = await request.json().catch(() => ({}));
    const studentId = String(body?.studentId || "").trim();
    const startDate = String(body?.startDate || "").trim();
    const reason = String(body?.reason || "Kursiyer talebiyle başlangıç tarihi değiştirildi.").trim().slice(0, 500);
    if (!studentId || !validDate(startDate)) return NextResponse.json({ ok:false,error:"Öğrenci veya yeni başlangıç tarihi geçersiz." },{status:400});
    if (startDate < todayTR()) return NextResponse.json({ok:false,error:"Başlangıç tarihi geçmiş bir güne alınamaz."},{status:400});

    const supabase = await createClient();
    const [{data:student},{data:enrollment,error:enrollmentError}] = await Promise.all([
      supabase.from("students").select("id,first_name,last_name,phone,guardian_phone").eq("organization_id",organizationId).eq("id",studentId).maybeSingle(),
      supabase.from("student_enrollments").select("id,student_id,start_date,planned_end_date,status,created_at").eq("organization_id",organizationId).eq("student_id",studentId).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle(),
    ]);
    if (enrollmentError || !enrollment) return NextResponse.json({ok:false,error:"Aktif öğrenci kaydı bulunamadı."},{status:404});
    const {data:attendance}=await supabase.from("attendance_records").select("id").eq("organization_id",organizationId).eq("student_id",studentId).limit(1);
    if(attendance?.length) return NextResponse.json({ok:false,error:"Öğrencinin yoklaması başlamış. Başlangıç tarihi artık bu ekrandan değiştirilemez."},{status:400});

    const oldDate=enrollment.start_date||null;
    const {data:updated,error:updateError}=await supabase.from("student_enrollments").update({start_date:startDate,updated_at:new Date().toISOString()}).eq("id",enrollment.id).eq("organization_id",organizationId).select("start_date,planned_end_date").single();
    if(updateError) return NextResponse.json({ok:false,error:`Başlangıç tarihi güncellenemedi: ${updateError.message}`},{status:500});

    const editor=(profile as any).full_name||(profile as any).email||"Yetkili kullanıcı";
    await supabase.from("student_activity_logs").insert({organization_id:organizationId,student_id:studentId,activity_type:"first_lesson_rescheduled",title:"İlk ders başlangıç tarihi değiştirildi",description:`${editor} tarafından başlangıç ${oldDate||"belirsiz"} tarihinden ${startDate} tarihine alındı. ${reason}`,new_value:{previous_start_date:oldDate,new_start_date:startDate,planned_end_date:updated?.planned_end_date||null,reason,performed_by:{profile_id:profile.id,name:editor}},source_type:"starting_students_center",source_id:enrollment.id,performed_at:new Date().toISOString()});

    const phones=Array.from(new Set([cleanPhone(student?.guardian_phone),cleanPhone(student?.phone)].filter(Boolean)));
    const studentName=`${student?.first_name||""} ${student?.last_name||""}`.trim()||"Kursiyerimiz";
    const whatsappMessage=`*SPRİNT YÜZME OKULU – BAŞLANGIÇ TARİHİ GÜNCELLEMESİ*\n\nDeğerli kursiyerimiz,\n${studentName} için kurs başlangıç tarihi güncellenmiştir.\n\n📅 Yeni başlangıç tarihi: *${trDate(startDate)}*\n${updated?.planned_end_date?`📅 Planlanan bitiş tarihi: *${trDate(updated.planned_end_date)}*\n`:""}\nDersleriniz kayıtlı grup ve seans programınız doğrultusunda devam edecektir.\n\n*Sprint Yüzme Okulu*\nBilgilendirme Hattı: 0551 896 83 19`;

    return NextResponse.json({ok:true,startDate:updated?.start_date||startDate,plannedEndDate:updated?.planned_end_date||null,whatsapp:{recipients:phones,message:whatsappMessage},message:"Başlangıç tarihi güncellendi. WhatsApp bilgilendirmesi hazırlandı."});
  } catch(error) { return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Başlangıç tarihi güncellenemedi."},{status:500}); }
}
