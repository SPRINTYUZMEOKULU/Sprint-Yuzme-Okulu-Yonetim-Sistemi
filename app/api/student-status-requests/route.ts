import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";

type RequestBody = {
  request_type: "deactivate" | "activate" | "delete";
  student_id: string;
  branch_id?: string | null;
  group_id?: string | null;
  reason: string;
  description?: string;
  old_status?: string;
  new_status?: string;
};

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = (await request.json()) as RequestBody;

    const studentId = clean(body.student_id, 60);
    const branchId = clean(body.branch_id, 60);
    const groupId = clean(body.group_id, 60);
    const reason = clean(body.reason, 250);
    const description = clean(body.description, 1000);
    const requestedType = body.request_type === "activate" ? "activate" : "deactivate";
    const oldStatus = clean(body.old_status, 50) || (requestedType === "activate" ? "passive" : "active");
    const newStatus = requestedType === "activate" ? "active" : "passive";

    if (!studentId) return NextResponse.json({ ok: false, error: "Öğrenci bilgisi bulunamadı." }, { status: 400 });
    if (!reason) return NextResponse.json({ ok: false, error: "Durum değişikliği gerekçesi yazılmalıdır." }, { status: 400 });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ ok: false, error: "Oturum bulunamadı." }, { status: 401 });

    const { data: studentRecord, error: studentError } = await supabase
      .from("students").select("organization_id,first_name,last_name,status").eq("id", studentId).single();
    if (studentError || !studentRecord?.organization_id) return NextResponse.json({ ok:false,error:"Öğrencinin organizasyon bilgisi bulunamadı.",details:studentError?.message },{status:400});

    if (studentRecord.status === newStatus) {
      return NextResponse.json({ok:false,error:newStatus === "active" ? "Öğrenci zaten aktif durumda." : "Öğrenci zaten pasif durumda."},{status:409});
    }

    const organizationId = studentRecord.organization_id;
    const { data: existingRequest, error: existingError } = await supabase
      .from("student_status_change_requests").select("id").eq("student_id", studentId).eq("request_type", requestedType).eq("status", "pending").maybeSingle();
    if (existingError) return NextResponse.json({ok:false,error:"Bekleyen talepler kontrol edilemedi.",details:existingError.message},{status:500});
    if (existingRequest) return NextResponse.json({ok:false,error:"Bu öğrenci için aynı durum değişikliğine ait yönetici onayı bekleyen bir talep bulunmaktadır."},{status:409});

    const { data, error } = await supabase.from("student_status_change_requests").insert({
      request_type: requestedType, student_id: studentId, organization_id: organizationId,
      branch_id: branchId || null, group_id: groupId || null, reason, description: description || null,
      old_status: oldStatus, new_status: newStatus, requested_status: newStatus, status: "pending", requested_by: user.id,
    }).select().single();
    if (error) return NextResponse.json({ok:false,error:"Öğrenci durum değişikliği talebi oluşturulamadı.",details:error.message},{status:500});

    try {
      const { data: managers } = await supabase.from("profiles").select("id").eq("organization_id", organizationId).eq("is_active", true).in("role", ["owner", "admin"]);
      const managerIds=(managers||[]).map((row:any)=>String(row.id)).filter(Boolean);
      const studentName=`${studentRecord.first_name||""} ${studentRecord.last_name||""}`.trim()||"Öğrenci";
      const activating=requestedType === "activate";
      await createNotification({
        organizationId,
        title: activating ? "Aktife alma onayı bekliyor" : "Pasife alma / arşivleme onayı bekliyor",
        body: activating ? `${studentName} yeniden kursa başlayacağı için aktife alma talebi oluşturuldu. Gerekçe: ${reason}` : `${studentName} için yönetici onayı bekleyen pasife alma talebi oluşturuldu. Gerekçe: ${reason}`,
        category:"approvals", eventKey: activating ? "student_status_activate_requested" : "student_status_deactivate_requested",
        notificationType:"student_status_requested", severity: activating ? "info" : "warning", priority:"high", studentId,
        sourceType:"student_status", sourceId:data.id, entityType:"student_status_request", entityId:data.id,
        targetPath:`/onay-merkezi?status=pending&archiveRequestId=${encodeURIComponent(data.id)}`,
        metadata:{request_id:data.id,student_id:studentId,request_type:requestedType,requested_by:user.id,requested_status:newStatus},
        createdBy:user.id,recipientProfileIds:managerIds.length?managerIds:undefined,push:true,
      });
    } catch(notificationError){console.error("status request notification error:",notificationError)}

    return NextResponse.json({ok:true,message:requestedType === "activate" ? "Aktife alma talebi yönetici onayına gönderildi." : "Pasife alma talebi yönetici onayına gönderildi.",request:data});
  } catch(error){console.error(error);return NextResponse.json({ok:false,error:"Sunucuda beklenmeyen bir hata oluştu."},{status:500})}
}

export async function GET() {
  try {
    const supabase=await createClient();
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user)return NextResponse.json({ok:false,error:"Oturum bulunamadı."},{status:401});
    const {data,error}=await supabase.from("student_status_change_requests").select("id,request_type,student_id,branch_id,group_id,reason,description,old_status,new_status,status,requested_by").eq("status","pending").in("request_type",["deactivate","activate"]);
    if(error)return NextResponse.json({ok:false,error:"Onay bekleyen öğrenci durum talepleri alınamadı.",details:error.message},{status:500});
    return NextResponse.json({ok:true,requests:data??[]});
  }catch(error){console.error("status request GET error:",error);return NextResponse.json({ok:false,error:"Sunucuda beklenmeyen bir hata oluştu."},{status:500})}
}
