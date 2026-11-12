import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { attendanceOperationsDb, validUuid } from "@/lib/attendance/operations-db";
import { publishEventNotification } from "@/lib/notifications/publish-event";
import { revalidateStudentSurfaces } from "@/lib/students/revalidate";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ok:false,error:"Geçersiz istek."},{status:403});
  const profile = await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);
  const body = await request.json().catch(()=>null);
  if (!body || !validUuid(body.studentId) || !validUuid(body.scheduleId) || !["call","absence","information","other"].includes(body.kind)
    || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || typeof (body.note ?? "") !== "string" || (body.note || "").length > 2000) {
    return NextResponse.json({ok:false,error:"Takip bilgisi geçersiz."},{status:400});
  }
  const { data, error } = await attendanceOperationsDb().rpc("create_attendance_student_followup", {
    p_actor:profile.id,p_student:body.studentId,p_schedule:body.scheduleId,p_date:body.date,p_kind:body.kind,p_note:body.note||"",
  });
  if (error || !data?.ok) return NextResponse.json({ok:false,error:error?.message||"Takip kaydedilemedi."},{status:error?.code==="42501"?403:400});
  let warning: string | undefined;
  if (!data.duplicate) {
    const notification = await publishEventNotification({organization_id:profile.organization_id!,category:"attendance",notification_type:"student_note_reminder",
      include_requester:profile.id,title:"Yoklama takibi oluşturuldu",body:data.body,student_id:body.studentId,
      source_type:"student_note",source_id:data.note_id,entity_id:data.note_id,entity_type:"student_note",
      target_path:`/ogrenciler/${body.studentId}?noteId=${data.note_id}#notlar`,created_by:profile.id,push_requested:true});
    if (notification.error) warning=notification.error.message;
  }
  revalidateStudentSurfaces(body.studentId);
  return NextResponse.json({...data,warning,message:data.duplicate?"Bu seans için aynı takip zaten kayıtlı.":"Takip kaydedildi. Öğrenci dosyası ve yönetici işlem listesine eklendi."});
}
