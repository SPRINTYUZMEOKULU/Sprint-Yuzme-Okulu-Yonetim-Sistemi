// @ts-nocheck
import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const ROLES=["owner","admin","branch_manager","registration_staff","accounting","coach"] as const;

function trParts(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const get=(t:string)=>parts.find((p)=>p.type===t)?.value||"";
  return {date:`${get("year")}-${get("month")}-${get("day")}`,minutes:Number(get("hour"))*60+Number(get("minute"))};
}
function weekday(date:string){const d=new Date(`${date}T12:00:00+03:00`);const n=d.getDay();return n===0?7:n;}
function minutes(value?:string|null){if(!value)return 0;const [h,m]=String(value).slice(0,5).split(":").map(Number);return (h||0)*60+(m||0);}

export async function GET(){
  try{
    const profile=await requireProfile([...ROLES]);
    const organizationId=profile.organization_id;
    if(!organizationId)return NextResponse.json({ok:true,created:0,alerts:[]});
    const supabase=await createClient();
    const now=trParts();
    const day=weekday(now.date);

    const [scheduleResult,attendanceResult,groupResult,existingResult]=await Promise.all([
      supabase.from("lesson_schedules").select("id,group_id,branch_id,coach_id,weekday,start_time,end_time,is_active").eq("organization_id",organizationId).eq("is_active",true).eq("weekday",day),
      supabase.from("attendance_records").select("id,schedule_id,group_id,lesson_date").eq("organization_id",organizationId).eq("lesson_date",now.date),
      supabase.from("training_groups").select("id,name").eq("organization_id",organizationId),
      supabase.from("system_notifications").select("id,entity_id,metadata,is_read").eq("organization_id",organizationId).eq("event_key","attendance_missing"),
    ]);
    const error=scheduleResult.error||attendanceResult.error||groupResult.error||existingResult.error;
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500});

    const attendedScheduleIds=new Set((attendanceResult.data||[]).map((r:any)=>String(r.schedule_id||"")).filter(Boolean));
    const attendedGroupIds=new Set((attendanceResult.data||[]).map((r:any)=>String(r.group_id||"")).filter(Boolean));
    const groupMap=new Map((groupResult.data||[]).map((g:any)=>[String(g.id),g.name||"Grup"]));
    const key=(scheduleId:any,date:any)=>`${String(scheduleId||"")}:${String(date||"")}`;
    const existingKeys=new Set((existingResult.data||[]).map((r:any)=>key(r.entity_id,r.metadata?.lesson_date)));

    const overdue=(scheduleResult.data||[]).filter((s:any)=>{
      const start=minutes(s.start_time);
      if(now.minutes<start+15)return false;
      if(attendedScheduleIds.has(String(s.id)))return false;
      // Eski kayıtlarda schedule_id boş yazılmış olabilir; aynı grup için kayıt varsa ikaz verme.
      if(!s.id&&attendedGroupIds.has(String(s.group_id||"")))return false;
      return true;
    });

    const inserts=overdue.filter((s:any)=>!existingKeys.has(key(s.id,now.date))).map((s:any)=>{
      const groupName=groupMap.get(String(s.group_id||""))||"Grup";
      const time=String(s.start_time||"").slice(0,5);
      return {
        organization_id:organizationId,
        recipient_profile_id:null,
        recipient_user_id:null,
        notification_type:"attendance_missing",
        category:"attendance",
        event_key:"attendance_missing",
        title:"Yoklama alınmadı",
        body:`${groupName} · ${time} dersi başlayalı 15 dakikadan fazla oldu. Yoklama henüz kaydedilmedi.`,
        message:`${groupName} · ${time} dersi için yoklama alınmadı.`,
        priority:"high",
        severity:"warning",
        source_type:"lesson_schedule",
        source_id:String(s.id),
        entity_type:"lesson_schedule",
        entity_id:String(s.id),
        target_path:`/yoklama?groupId=${encodeURIComponent(String(s.group_id||""))}&scheduleId=${encodeURIComponent(String(s.id))}`,
        is_read:false,
        push_required:false,
        push_requested:false,
        metadata:{lesson_date:now.date,group_id:s.group_id,schedule_id:s.id,start_time:s.start_time,branch_id:s.branch_id,coach_id:s.coach_id},
      };
    });
    if(inserts.length){const {error:insertError}=await supabase.from("system_notifications").insert(inserts);if(insertError)return NextResponse.json({ok:false,error:insertError.message},{status:500});}
    return NextResponse.json({ok:true,created:inserts.length,alerts:overdue.map((s:any)=>({scheduleId:s.id,groupId:s.group_id,groupName:groupMap.get(String(s.group_id||""))||"Grup",startTime:s.start_time,date:now.date}))});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Yoklama uyarıları kontrol edilemedi."},{status:500});}
}
