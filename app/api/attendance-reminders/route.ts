import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";

export const dynamic = "force-dynamic";
const roles = ["owner","admin","branch_manager","registration_staff","accounting","coach"] as const;

type Priority = "low"|"normal"|"high"|"critical";

export async function GET(){
  const profile=await requireProfile([...roles]);
  const supabase=await createClient();
  const {data,error}=await supabase.from("alerts")
    .select("id,title,description,priority,status,source_id,action_url,due_at,created_at,assigned_to")
    .eq("organization_id",profile.organization_id)
    .eq("alert_type","attendance_reminder")
    .in("status",["open","in_progress"])
    .order("created_at",{ascending:false})
    .limit(20);
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  return NextResponse.json({ok:true,items:data||[]});
}

export async function POST(request:Request){
  const profile=await requireProfile([...roles]);
  if(!profile.organization_id)return NextResponse.json({ok:false,error:"Kurum bilgisi bulunamadı."},{status:400});
  const body=await request.json().catch(()=>({}));
  const note=String(body.note||"").trim();
  const studentId=String(body.studentId||"").trim()||null;
  const requestedPriority=String(body.priority||"normal") as Priority;
  const priority:Priority=["low","normal","high","critical"].includes(requestedPriority)?requestedPriority:"normal";
  const dueDate=String(body.dueDate||"").trim();
  if(note.length<3)return NextResponse.json({ok:false,error:"Hatırlatma notu en az 3 karakter olmalı."},{status:400});

  const supabase=await createClient();
  let studentName="";
  if(studentId){
    const {data:student,error:studentError}=await supabase.from("students")
      .select("id,first_name,last_name")
      .eq("organization_id",profile.organization_id)
      .eq("id",studentId)
      .maybeSingle();
    if(studentError||!student)return NextResponse.json({ok:false,error:"Öğrenci bulunamadı."},{status:404});
    studentName=`${student.first_name||""} ${student.last_name||""}`.trim();
  }

  const title=studentName?`${studentName} · Yoklama hatırlatması`:"Yoklama notu / hatırlatma";
  const dueAt=dueDate?new Date(`${dueDate}T09:00:00+03:00`).toISOString():null;
  const actionUrl=studentId?`/ogrenciler/${studentId}`:"/yoklama";
  const {data:alert,error}=await supabase.from("alerts").insert({
    organization_id:profile.organization_id,
    alert_type:"attendance_reminder",
    title,
    description:note,
    priority,
    status:"open",
    assigned_to:profile.id,
    source_table:studentId?"students":"attendance",
    source_id:studentId,
    action_label:studentId?"Öğrenci Dosyasını Aç":"Yoklamaya Git",
    action_url:actionUrl,
    due_at:dueAt,
  }).select("id,title,description,priority,status,source_id,action_url,due_at,created_at,assigned_to").single();
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});

  try{
    await createNotification({
      organizationId:profile.organization_id,
      title:"Yoklama hatırlatması eklendi",
      body:studentName?`${studentName}: ${note}`:note,
      category:"attendance",
      notificationType:"attendance_reminder",
      severity:priority==="critical"?"critical":priority==="high"?"warning":"info",
      priority:priority==="critical"?"critical":priority==="high"?"high":"normal",
      studentId,
      sourceType:"attendance_reminder",
      sourceId:alert.id,
      entityType:"alert",
      entityId:alert.id,
      targetPath:"/uyarilar",
      metadata:{alert_id:alert.id,due_at:dueAt,student_name:studentName||null},
      createdBy:profile.id,
      recipientProfileIds:[profile.id],
      push:true,
    });
  }catch(error){console.error("attendance reminder notification:",error)}

  return NextResponse.json({ok:true,item:alert});
}

export async function PATCH(request:Request){
  const profile=await requireProfile([...roles]);
  const body=await request.json().catch(()=>({}));
  const id=String(body.id||"").trim();
  if(!id)return NextResponse.json({ok:false,error:"Hatırlatma bulunamadı."},{status:400});
  const supabase=await createClient();
  const now=new Date().toISOString();
  const {error}=await supabase.from("alerts").update({status:"completed",completed_at:now,completed_by:profile.id,updated_at:now})
    .eq("organization_id",profile.organization_id).eq("id",id).eq("alert_type","attendance_reminder");
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  await supabase.from("system_notifications").update({is_read:true,read_at:now})
    .eq("organization_id",profile.organization_id).eq("source_type","attendance_reminder").eq("source_id",id).eq("recipient_profile_id",profile.id);
  return NextResponse.json({ok:true});
}
