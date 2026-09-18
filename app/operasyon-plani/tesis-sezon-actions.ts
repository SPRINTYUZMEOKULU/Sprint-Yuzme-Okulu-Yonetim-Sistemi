"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { calculateLessonBalance } from "@/lib/lessons/balance";

const ROLES = ["owner", "admin", "branch_manager"] as const;
const clean = (v: FormDataEntryValue | null) => String(v || "").trim();
const jsToIso = (day:number) => day === 0 ? 7 : day;

function calculateEndDate(startDate:string, lessonCount:number, weekdays:number[]) {
  if (lessonCount <= 0) return startDate;
  const selected = new Set(weekdays);
  const d = new Date(`${startDate}T12:00:00+03:00`);
  let count = 0;
  for (let guard=0; guard<730; guard++) {
    if (selected.has(jsToIso(d.getDay()))) count++;
    if (count >= lessonCount) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    d.setDate(d.getDate()+1);
  }
  return startDate;
}

function refresh(){
  ["/operasyon-plani","/ogrenciler","/yoklama","/ders-programi","/kayit-yenilemeleri"].forEach((path) => revalidatePath(path));
}

export async function closeFacility(formData:FormData){
  const profile = await requireProfile([...ROLES]);
  if(!profile.organization_id) throw new Error("Organizasyon bulunamadı.");
  const branchId=clean(formData.get("branch_id"));
  const closureDate=clean(formData.get("closure_date"));
  const estimatedOpenDate=clean(formData.get("estimated_open_date")) || null;
  const note=clean(formData.get("note")) || null;
  if(!branchId || !closureDate) throw new Error("Havuz ve kapanış tarihi zorunludur.");
  const supabase=await createClient();
  const {data:existing}=await supabase.from("facility_season_pauses").select("id").eq("organization_id",profile.organization_id).eq("branch_id",branchId).eq("status","closed").maybeSingle();
  if(existing) throw new Error("Bu tesis için zaten aktif bir kapanış bulunuyor.");
  const {data:pause,error}=await supabase.from("facility_season_pauses").insert({organization_id:profile.organization_id,branch_id:branchId,status:"closed",closure_date:closureDate,estimated_open_date:estimatedOpenDate,note,created_by:profile.id}).select("id").single();
  if(error||!pause) throw error || new Error("Kapanış oluşturulamadı.");
  const {data:enrollments,error:enrollmentError}=await supabase.from("student_enrollments").select("id,student_id,group_id,total_lessons,used_lessons,start_date,planned_end_date").eq("organization_id",profile.organization_id).eq("branch_id",branchId).eq("status","active");
  if(enrollmentError) throw enrollmentError;
  const groupIds=Array.from(new Set((enrollments||[]).map((e:any)=>e.group_id).filter(Boolean)));
  const [scheduleResult,exceptionResult]=await Promise.all([
    groupIds.length?supabase.from("lesson_schedules").select("id,group_id,weekday,start_time,end_time").eq("organization_id",profile.organization_id).in("group_id",groupIds).eq("is_active",true):Promise.resolve({data:[],error:null} as any),
    supabase.from("lesson_session_exceptions").select("lesson_date,group_id,schedule_id,exception_type").eq("organization_id",profile.organization_id).lte("lesson_date",closureDate),
  ]);
  if(scheduleResult.error) throw scheduleResult.error;
  if(exceptionResult.error) throw exceptionResult.error;
  const schedulesByGroup=new Map<string,any[]>();
  for(const row of scheduleResult.data||[]){const key=String(row.group_id);const list=schedulesByGroup.get(key)||[];list.push(row);schedulesByGroup.set(key,list);}
  // Kapanış tarihi başladığı anda hakları dondur: kapanış günündeki seanslar tüketilmiş sayılmaz.
  const closeAt=new Date(`${closureDate}T00:00:00+03:00`);
  const projected=new Map<string,ReturnType<typeof calculateLessonBalance>>();
  for(const e of enrollments||[]){
    projected.set(e.id,calculateLessonBalance({
      totalLessons:Number(e.total_lessons||0),
      storedUsedLessons:Number(e.used_lessons||0),
      startDate:e.start_date||null,
      normalEndDate:e.planned_end_date||null,
      schedules:schedulesByGroup.get(String(e.group_id))||[],
      exceptions:(exceptionResult.data||[]) as any[],
      compensationBalance:0,
      now:closeAt,
    }));
  }
  const snapshots=(enrollments||[]).map((e:any)=>{const balance=projected.get(e.id)!;return {pause_id:pause.id,organization_id:profile.organization_id,student_id:e.student_id,enrollment_id:e.id,source_group_id:e.group_id,remaining_lessons:balance.normalRemainingLessons,used_lessons_at_close:balance.usedLessons,original_planned_end_date:e.planned_end_date};});
  if(snapshots.length){ const {error:snapshotError}=await supabase.from("facility_pause_student_snapshots").insert(snapshots); if(snapshotError) throw snapshotError; }
  await supabase.from("student_activity_logs").insert((enrollments||[]).map((e:any)=>{const balance=projected.get(e.id)!;return {organization_id:profile.organization_id,student_id:e.student_id,activity_type:"facility_pause",title:"Tesis / sezon kapanışı",description:`${closureDate} tarihinden itibaren ders hakkı donduruldu. Kalan normal ders: ${balance.normalRemainingLessons}.`,new_value:{pause_id:pause.id,branch_id:branchId,closure_date:closureDate,calculated_used_lessons:balance.usedLessons,calculated_remaining_lessons:balance.normalRemainingLessons}};}));
  refresh(); return {ok:true,pauseId:pause.id,affected:snapshots.length};
}

export async function startFacility(formData:FormData){
  const profile=await requireProfile([...ROLES]); if(!profile.organization_id) throw new Error("Organizasyon bulunamadı.");
  const pauseId=clean(formData.get("pause_id")); const startDate=clean(formData.get("start_date")); const targetBranchId=clean(formData.get("target_branch_id")); const targetGroupId=clean(formData.get("target_group_id"));
  if(!pauseId||!startDate||!targetGroupId) throw new Error("Kapanış, START tarihi ve hedef grup zorunludur.");
  const supabase=await createClient();
  const {data:pause}=await supabase.from("facility_season_pauses").select("*").eq("id",pauseId).eq("organization_id",profile.organization_id).eq("status","closed").maybeSingle(); if(!pause) throw new Error("Aktif kapanış bulunamadı.");
  const {data:schedules,error:scheduleError}=await supabase.from("lesson_schedules").select("weekday").eq("organization_id",profile.organization_id).eq("group_id",targetGroupId).eq("is_active",true); if(scheduleError) throw scheduleError;
  const weekdays=Array.from(new Set((schedules||[]).map((s:any)=>Number(s.weekday)).filter((n:number)=>n>=1&&n<=7))); if(!weekdays.length) throw new Error("Hedef grubun aktif ders programı yok.");
  const {data:snapshots,error:snapshotError}=await supabase.from("facility_pause_student_snapshots").select("*").eq("pause_id",pauseId).eq("organization_id",profile.organization_id); if(snapshotError) throw snapshotError;
  for(const row of snapshots||[]){
    const endDate=calculateEndDate(startDate,Number(row.remaining_lessons||0),weekdays);
    const {error}=await supabase.from("student_enrollments").update({group_id:targetGroupId,branch_id:targetBranchId||pause.branch_id,start_date:startDate,planned_end_date:endDate,normal_end_date:endDate,lesson_weekdays:weekdays.map((d:number)=>d===7?0:d),weekly_frequency:weekdays.length,updated_at:new Date().toISOString()}).eq("id",row.enrollment_id).eq("organization_id",profile.organization_id); if(error) throw error;
    await supabase.from("students").update({branch_id:targetBranchId||pause.branch_id,preferred_group_id:targetGroupId,updated_at:new Date().toISOString()}).eq("id",row.student_id).eq("organization_id",profile.organization_id);
    await supabase.from("facility_pause_student_snapshots").update({resumed_at:startDate,target_group_id:targetGroupId,new_planned_end_date:endDate}).eq("id",row.id);
    await supabase.from("student_activity_logs").insert({organization_id:profile.organization_id,student_id:row.student_id,activity_type:targetBranchId&&targetBranchId!==pause.branch_id?"facility_transfer_start":"facility_start",title:targetBranchId&&targetBranchId!==pause.branch_id?"Aktar + START":"Tesis START",description:`${row.remaining_lessons} kalan ders ${startDate} tarihinden itibaren yeniden planlandı. Yeni bitiş: ${endDate}.`,old_value:{branch_id:pause.branch_id,group_id:row.source_group_id},new_value:{branch_id:targetBranchId||pause.branch_id,group_id:targetGroupId,start_date:startDate,planned_end_date:endDate}});
  }
  const transferred=Boolean(targetBranchId&&targetBranchId!==pause.branch_id);
  const {error:pauseError}=await supabase.from("facility_season_pauses").update({status:transferred?"transferred":"started",actual_start_date:startDate,target_branch_id:targetBranchId||pause.branch_id,target_group_id:targetGroupId,started_by:profile.id,updated_at:new Date().toISOString()}).eq("id",pauseId).eq("organization_id",profile.organization_id); if(pauseError) throw pauseError;
  refresh(); return {ok:true,affected:(snapshots||[]).length};
}
