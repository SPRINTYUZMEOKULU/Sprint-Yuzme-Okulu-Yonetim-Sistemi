import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES = ["owner","admin","branch_manager","registration_staff","accounting","coach"] as const;

function trToday(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(t:string)=>parts.find((p)=>p.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function isoWeekday(date:string){const d=new Date(`${date}T12:00:00+03:00`);const n=d.getDay();return n===0?7:n;}
function addDays(date:string,days:number){const d=new Date(`${date}T12:00:00+03:00`);d.setDate(d.getDate()+days);return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
function daysBetween(from:string,to:string){const a=new Date(`${from}T12:00:00+03:00`).getTime();const b=new Date(`${to}T12:00:00+03:00`).getTime();if(!Number.isFinite(a)||!Number.isFinite(b))return 0;return Math.max(0,Math.round((b-a)/86400000));}

export async function GET(){
  try{
    const profile=await requireProfile([...ROLES]);
    const organizationId=profile.organization_id;
    if(!organizationId)return NextResponse.json({ok:true,count:0,waitingToStart:0,waitingFirstAttendance:0,students:[]});
    const supabase=await createClient();

    const [studentsResult,enrollmentsResult,attendanceResult,transferStartedResult,groupsResult,branchesResult,schedulesResult]=await Promise.all([
      supabase.from("students").select("id,first_name,last_name,student_number,guardian_name,guardian_phone,phone,status,registration_source").eq("organization_id",organizationId).eq("status","active").eq("is_deleted",false).eq("registration_source","web_form"),
      supabase.from("student_enrollments").select("id,student_id,group_id,branch_id,start_date,status,created_at").eq("organization_id",organizationId).eq("status","active").order("created_at",{ascending:false}),
      supabase.from("attendance_records").select("student_id").eq("organization_id",organizationId),
      supabase.from("student_activity_logs").select("student_id").eq("organization_id",organizationId).eq("activity_type","legacy_transfer_manager_confirmed"),
      supabase.from("training_groups").select("id,name,branch_id").eq("organization_id",organizationId).eq("is_active",true),
      supabase.from("branches").select("id,name").eq("organization_id",organizationId).eq("is_active",true),
      supabase.from("lesson_schedules").select("id,group_id,weekday,start_time,end_time,is_active").eq("organization_id",organizationId).eq("is_active",true),
    ]);

    const error=studentsResult.error||enrollmentsResult.error||attendanceResult.error||transferStartedResult.error||groupsResult.error||branchesResult.error||schedulesResult.error;
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500});

    const attended=new Set((attendanceResult.data||[]).map((r:any)=>String(r.student_id||"")).filter(Boolean));
    const transferStarted=new Set((transferStartedResult.data||[]).map((r:any)=>String(r.student_id||"")).filter(Boolean));
    const enrollmentMap=new Map<string,any>();
    for(const row of enrollmentsResult.data||[]){if(row.student_id&&!enrollmentMap.has(row.student_id))enrollmentMap.set(row.student_id,row);}
    const groupMap=new Map((groupsResult.data||[]).map((r:any)=>[String(r.id),r]));
    const branchMap=new Map((branchesResult.data||[]).map((r:any)=>[String(r.id),r.name||"Şube"]));
    const schedulesByGroup=new Map<string,any[]>();
    for(const s of schedulesResult.data||[]){const id=String(s.group_id||"");if(!id)continue;const arr=schedulesByGroup.get(id)||[];arr.push(s);schedulesByGroup.set(id,arr);}

    const today=trToday();
    function nextLesson(groupId:string,startDate?:string|null){const schedules=schedulesByGroup.get(groupId)||[];if(!schedules.length)return null;const base=startDate&&startDate>today?startDate:today;for(let offset=0;offset<21;offset++){const date=addDays(base,offset);const wd=isoWeekday(date);const matches=schedules.filter((s:any)=>Number(s.weekday)===wd).sort((a:any,b:any)=>String(a.start_time||"").localeCompare(String(b.start_time||"")));if(matches.length){const s=matches[0];return {date,startTime:String(s.start_time||"").slice(0,5),endTime:String(s.end_time||"").slice(0,5),scheduleId:s.id};}}return null;}

    const students=(studentsResult.data||[]).flatMap((student:any)=>{
      const studentId=String(student.id);
      if(attended.has(studentId)||transferStarted.has(studentId))return [];
      const enrollment=enrollmentMap.get(student.id);
      if(!enrollment)return [];
      const group=groupMap.get(String(enrollment.group_id||""));
      const branchId=String(group?.branch_id||enrollment.branch_id||"");
      const startDate=enrollment.start_date||null;
      const phase=startDate&&startDate>today?"waiting_start":"waiting_first_attendance";
      const next=nextLesson(String(enrollment.group_id||""),startDate);
      return [{id:student.id,name:`${student.first_name||""} ${student.last_name||""}`.trim(),studentNumber:student.student_number||null,groupId:enrollment.group_id||null,groupName:group?.name||"Grup bilgisi yok",branchName:branchMap.get(branchId)||"Şube bilgisi yok",startDate,phase,daysUntilStart:startDate&&startDate>today?daysBetween(today,startDate):0,nextLesson:next,phone:student.guardian_phone||student.phone||null,guardianName:student.guardian_name||null}];
    }).sort((a:any,b:any)=>{if(a.phase!==b.phase)return a.phase==="waiting_first_attendance"?-1:1;const ad=a.nextLesson?.date||"9999-12-31";const bd=b.nextLesson?.date||"9999-12-31";if(ad!==bd)return ad.localeCompare(bd);return String(a.nextLesson?.startTime||"").localeCompare(String(b.nextLesson?.startTime||""));});

    const waitingToStart=students.filter((s:any)=>s.phase==="waiting_start").length;
    const waitingFirstAttendance=students.filter((s:any)=>s.phase==="waiting_first_attendance").length;
    return NextResponse.json({ok:true,count:students.length,waitingToStart,waitingFirstAttendance,students});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Başlayacak kursiyerler yüklenemedi."},{status:500});}
}
