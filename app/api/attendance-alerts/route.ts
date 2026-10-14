import { createNotification } from "@/lib/notifications/create-notification";
import { loadAttendanceEligibility, missingAttendanceStudents } from "@/lib/notifications/attendance-eligibility";
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
    if(!organizationId)return NextResponse.json({ok:true,created:0,firstLessonCreated:0,alerts:[]});
    const supabase=await createClient();
    const now=trParts();
    const day=weekday(now.date);

    const [scheduleResult,attendanceResult,historyResult,groupResult,studentResult,existingMissingResult,existingFirstResult]=await Promise.all([
      supabase.from("lesson_schedules").select("id,group_id,branch_id,coach_id,weekday,start_time,end_time,is_active").eq("organization_id",organizationId).eq("is_active",true).in("weekday",day===7?[0,7]:[day]),
      supabase.from("attendance_records").select("id,student_id,schedule_id,group_id,lesson_date,status").eq("organization_id",organizationId).eq("lesson_date",now.date),
      supabase.from("attendance_records").select("id,student_id,lesson_date,status,created_at").eq("organization_id",organizationId).order("lesson_date",{ascending:true}).order("created_at",{ascending:true}),
      supabase.from("training_groups").select("id,name").eq("organization_id",organizationId),
      supabase.from("students").select("id,first_name,last_name").eq("organization_id",organizationId),
      supabase.from("system_notifications").select("id,entity_id,metadata,is_read").eq("organization_id",organizationId).eq("event_key","attendance_missing"),
      supabase.from("system_notifications").select("id,student_id,event_key,metadata").eq("organization_id",organizationId).in("event_key",["first_lesson_attended","first_lesson_absent","first_lesson_excused"]),
    ]);
    const error=scheduleResult.error||attendanceResult.error||historyResult.error||groupResult.error||studentResult.error||existingMissingResult.error||existingFirstResult.error;
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500});

    const eligibility=await loadAttendanceEligibility(supabase,organizationId);
    const attendedScheduleIds=new Set((attendanceResult.data||[]).map((r:any)=>String(r.schedule_id||"")).filter(Boolean));
    const attendedGroupIds=new Set((attendanceResult.data||[]).map((r:any)=>String(r.group_id||"")).filter(Boolean));
    const groupMap=new Map((groupResult.data||[]).map((g:any)=>[String(g.id),g.name||"Grup"]));
    const studentMap=new Map((studentResult.data||[]).map((s:any)=>[String(s.id),`${s.first_name||""} ${s.last_name||""}`.trim()||"Kursiyer"]));
    const key=(scheduleId:any,date:any)=>`${String(scheduleId||"")}:${String(date||"")}`;
    const existingKeys=new Set((existingMissingResult.data||[]).map((r:any)=>key(r.entity_id,r.metadata?.lesson_date)));

    const overdue=(scheduleResult.data||[]).filter((s:any)=>{
      const start=minutes(s.start_time);
      if(now.minutes<start+15)return false;
      return missingAttendanceStudents(eligibility,s,now.date,attendanceResult.data||[]).length>0;
    });

    const overdueIds=new Set(overdue.map(s=>s.id));
    const obsolete=(existingMissingResult.data||[]).filter(row=>!row.is_read&&row.metadata?.lesson_date===now.date&&!overdueIds.has(row.entity_id));
    for(const row of obsolete){const {error:closeError}=await supabase.from("system_notifications").update({is_read:true,metadata:{...(row.metadata||{}),resolved_reason:"cancelled_or_no_pending_attendance",resolved_at:new Date().toISOString()}}).eq("organization_id",organizationId).eq("id",row.id);if(closeError)throw closeError;}
    const missingInserts=overdue.filter((s:any)=>!existingKeys.has(key(s.id,now.date))).map((s:any)=>{
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
        target_path:`/yoklama?date=${now.date}&branchId=${encodeURIComponent(String(s.branch_id||""))}&time=${String(s.start_time||"").slice(0,5)}&scheduleId=${encodeURIComponent(String(s.id))}`,
        is_read:false,
        push_required:false,
        push_requested:false,
        metadata:{lesson_date:now.date,group_id:s.group_id,schedule_id:s.id,start_time:s.start_time,branch_id:s.branch_id,coach_id:s.coach_id},
      };
    });

    const firstHistoryByStudent=new Map<string,any>();
    for(const row of historyResult.data||[]){
      const studentId=String(row.student_id||"");
      if(studentId&&!firstHistoryByStudent.has(studentId))firstHistoryByStudent.set(studentId,row);
    }
    const existingFirstKeys=new Set((existingFirstResult.data||[]).map((r:any)=>`${String(r.student_id||"")}:${String(r.metadata?.lesson_date||"")}`));
    const firstLessonInserts=[];
    for(const row of attendanceResult.data||[]){
      const studentId=String(row.student_id||"");
      if(!studentId||!["present","absent","excused","compensation"].includes(row.status))continue;
      const first=firstHistoryByStudent.get(studentId);
      if(!first||String(first.id)!==String(row.id))continue;
      const firstKey=`${studentId}:${now.date}`;
      if(existingFirstKeys.has(firstKey))continue;

      const name=studentMap.get(studentId)||"Kursiyer";
      const groupName=groupMap.get(String(row.group_id||""))||"Grup";
      const status=String(row.status||"");
      const present=status==="present"||status==="compensation";
      const absent=status==="absent";
      const eventKey=present?"first_lesson_attended":absent?"first_lesson_absent":"first_lesson_excused";
      const title=present?"İlk dersine katıldı":absent?"İlk dersine gelmedi":"İlk dersinde izinli";
      const body=present
        ? `${name}, ${groupName} grubundaki ilk dersine katıldı. Kursiyer artık Başlayacak Kursiyerler listesinden çıkarılacak.`
        : absent
          ? `${name}, ${groupName} grubundaki ilk dersine gelmedi. Veli/kursiyer ile iletişim kurulması önerilir.`
          : `${name}, ${groupName} grubundaki ilk dersinde izinli olarak işaretlendi.`;

      firstLessonInserts.push({
        organization_id:organizationId,
        recipient_profile_id:null,
        recipient_user_id:null,
        notification_type:eventKey,
        category:"attendance",
        event_key:eventKey,
        title,
        body,
        message:body,
        priority:absent?"high":"normal",
        severity:absent?"warning":present?"success":"info",
        student_id:studentId,
        source_type:"attendance_record",
        source_id:String(row.id),
        entity_type:"student",
        entity_id:studentId,
        target_path:`/ogrenciler/${encodeURIComponent(studentId)}`,
        is_read:false,
        push_required:false,
        push_requested:false,
        metadata:{lesson_date:now.date,group_id:row.group_id,schedule_id:row.schedule_id,status:row.status,first_lesson:true},
      });
      existingFirstKeys.add(firstKey);
    }

    for(const row of missingInserts){
      const result=await createNotification({organizationId,title:row.title,body:row.body,category:"attendance",eventKey:"attendance_missing",notificationType:"attendance_missing",priority:"high",severity:"warning",sourceType:"lesson_schedule",sourceId:row.source_id,entityType:"lesson_schedule",entityId:row.entity_id,targetPath:row.target_path,metadata:row.metadata,createdBy:profile.id,push:true});
      if(!result.ok)throw new Error(result.message);
    }
    if(firstLessonInserts.length){const {error:insertError}=await supabase.from("system_notifications").insert(firstLessonInserts);if(insertError)return NextResponse.json({ok:false,error:insertError.message},{status:500});}

    return NextResponse.json({
      ok:true,
      created:missingInserts.length,
      firstLessonCreated:firstLessonInserts.length,
      alerts:overdue.map((s:any)=>({scheduleId:s.id,groupId:s.group_id,groupName:groupMap.get(String(s.group_id||""))||"Grup",startTime:s.start_time,date:now.date}))
    });
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Yoklama uyarıları kontrol edilemedi."},{status:500});}
}
