"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner", "admin", "branch_manager", "registration_staff"] as const;
const DAY_NAMES: Record<number, string> = {1:"Pazartesi",2:"Salı",3:"Çarşamba",4:"Perşembe",5:"Cuma",6:"Cumartesi",7:"Pazar"};
function cleanPhone(value?: string | null){return (value||"").replace(/\D/g,"");}
function formatDateTR(value?:string|null){if(!value)return "—";const [y,m,d]=value.split("-");return y&&m&&d?`${d}.${m}.${y}`:value;}
function nextDates(afterDate:string,weekdays:number[],count:number){const set=new Set(weekdays);const c=new Date(`${afterDate}T12:00:00`);const out:string[]=[];for(let i=0;i<730&&out.length<count;i++){c.setDate(c.getDate()+1);const js=c.getDay();const iso=js===0?7:js;if(!set.has(iso))continue;out.push(`${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,"0")}-${String(c.getDate()).padStart(2,"0")}`);}return out;}

export type GiftLessonInput={studentIds:string[];lessonCount:number;targetGroupId:string;targetScheduleId?:string|null;note?:string};

export async function addGiftLessons(input:GiftLessonInput){
  const profile=await requireProfile([...ALLOWED_ROLES]);
  const organizationId=profile.organization_id;
  if(!organizationId)return{ok:false as const,message:"Organizasyon bilgisi bulunamadı.",messages:[]};
  const ids=Array.from(new Set((input.studentIds||[]).filter(Boolean))).slice(0,250);
  const lessonCount=Math.max(1,Math.min(12,Number(input.lessonCount||1)));
  if(!ids.length||!input.targetGroupId)return{ok:false as const,message:"Kursiyer ve grup seçimi zorunludur.",messages:[]};
  const supabase=await createClient();
  const [studentsRes,groupRes,schedulesRes,enrollmentsRes,plansRes]=await Promise.all([
    supabase.from("students").select("id,first_name,last_name,phone,guardian_phone,status").eq("organization_id",organizationId).in("id",ids),
    supabase.from("training_groups").select("id,name,branch_id,course_type").eq("organization_id",organizationId).eq("id",input.targetGroupId).maybeSingle(),
    supabase.from("lesson_schedules").select("id,group_id,weekday,start_time,end_time,is_active").eq("organization_id",organizationId).eq("group_id",input.targetGroupId).eq("is_active",true),
    supabase.from("student_enrollments").select("id,student_id,group_id,total_lessons,used_lessons,planned_end_date,status,created_at").eq("organization_id",organizationId).eq("status","active").in("student_id",ids).order("created_at",{ascending:false}),
    supabase.from("student_attendance_plans").select("id,student_id,enrollment_id,group_id,selected_weekdays,normal_planned_end_date,compensation_planned_end_date,is_active").eq("organization_id",organizationId).eq("is_active",true).in("student_id",ids),
  ]);
  const loadError=studentsRes.error||groupRes.error||schedulesRes.error||enrollmentsRes.error||plansRes.error;
  if(loadError)return{ok:false as const,message:`Hediye ders verileri yüklenemedi: ${loadError.message}`,messages:[]};
  const group=groupRes.data;const schedules=schedulesRes.data||[];
  if(!group||!schedules.length)return{ok:false as const,message:"Seçilen grup veya aktif seans bulunamadı.",messages:[]};
  const selectedSchedule=input.targetScheduleId?schedules.find((s:any)=>s.id===input.targetScheduleId):null;
  if(input.targetScheduleId&&!selectedSchedule)return{ok:false as const,message:"Seçilen seans bu gruba ait değil.",messages:[]};
  const enrollmentMap=new Map<string,any>();for(const e of enrollmentsRes.data||[])if(!enrollmentMap.has(e.student_id))enrollmentMap.set(e.student_id,e);
  const planMap=new Map<string,any>();for(const p of plansRes.data||[])if(!planMap.has(p.student_id))planMap.set(p.student_id,p);
  const messages:any[]=[];let processed=0;let skipped=0;
  for(const student of studentsRes.data||[]){
    const enrollment=enrollmentMap.get(student.id);if(!enrollment){skipped++;continue;}
    const plan=planMap.get(student.id);
    let weekdays=selectedSchedule?[Number(selectedSchedule.weekday)]:(Array.isArray(plan?.selected_weekdays)?plan.selected_weekdays.map(Number).filter((x:number)=>x>=1&&x<=7):[]);
    if(!weekdays.length)weekdays=Array.from(new Set(schedules.map((s:any)=>Number(s.weekday)).filter((x:number)=>x>=1&&x<=7)));
    const oldEnd=plan?.compensation_planned_end_date||plan?.normal_planned_end_date||enrollment.planned_end_date;
    const giftDates=nextDates(oldEnd||new Date().toISOString().slice(0,10),weekdays,lessonCount);const newEnd=giftDates[giftDates.length-1]||oldEnd;
    const now=new Date().toISOString();
    const updateEnrollment=await supabase.from("student_enrollments").update({total_lessons:Number(enrollment.total_lessons||0)+lessonCount,planned_end_date:newEnd,updated_at:now}).eq("id",enrollment.id).eq("organization_id",organizationId);
    if(updateEnrollment.error){skipped++;continue;}
    if(plan?.id&&newEnd)await supabase.from("student_attendance_plans").update({compensation_planned_end_date:newEnd,updated_by:profile.id,updated_at:now}).eq("id",plan.id).eq("organization_id",organizationId);
    for(const lessonDate of giftDates){
      const weekday=new Date(`${lessonDate}T12:00:00`).getDay()||7;
      const target=selectedSchedule||schedules.find((s:any)=>Number(s.weekday)===weekday)||schedules[0];
      await supabase.from("student_compensation_lessons").insert({organization_id:organizationId,student_id:student.id,enrollment_id:enrollment.id,source_request_id:null,target_group_id:group.id,target_schedule_id:target?.id||null,lesson_date:lessonDate,status:"planned",note:`SPRİNT YÜZME OKULU hediye dersi${input.note?.trim()?` · ${input.note.trim()}`:""}`,created_by:profile.id,created_at:now,updated_at:now});
    }
    await supabase.from("student_activity_logs").insert({organization_id:organizationId,student_id:student.id,activity_type:"gift_lesson",title:`SPRİNT tarafından ${lessonCount} hediye ders`,description:`${group.name} grubuna ${lessonCount} hediye ders eklendi. Önceki bitiş: ${formatDateTR(oldEnd)} · Yeni bitiş: ${formatDateTR(newEnd)}${input.note?.trim()?` · ${input.note.trim()}`:""}`,source_type:"ready_messages",source_id:enrollment.id,performed_by:profile.id,performed_at:now});
    const studentName=`${student.first_name||""} ${student.last_name||""}`.trim();const adult=String(group.course_type||"").toLocaleLowerCase("tr-TR").includes("yetişkin");
    const recipient=adult?cleanPhone(student.phone)||cleanPhone(student.guardian_phone)||null:cleanPhone(student.guardian_phone)||cleanPhone(student.phone)||null;
    const scheduleText=selectedSchedule?`${DAY_NAMES[Number(selectedSchedule.weekday)]||""} ${String(selectedSchedule.start_time||"").slice(0,5)}-${String(selectedSchedule.end_time||"").slice(0,5)}`:weekdays.map((d:number)=>DAY_NAMES[d]).join(" / ");
    messages.push({studentId:student.id,studentName,recipient,message:`🎁 *SPRİNT YÜZME OKULU'NDAN HEDİYE DERS*\n\nDeğerli ${adult?"Kursiyerimiz":"Velimiz"},\n\n*${studentName}* için SPRİNT YÜZME OKULU tarafından *${lessonCount} adet yüzme dersi hediye edilmiştir.* 💙\n\n🏊 *Grup:* ${group.name}\n🗓️ *Ders planı:* ${scheduleText}\n🎁 *Hediye ders:* ${lessonCount} ders\n📌 *Önceki planlanan bitiş:* ${formatDateTR(oldEnd)}\n✅ *Yeni planlanan bitiş:* ${formatDateTR(newEnd)}\n\nHediye dersleriniz sisteminize işlenmiş ve ders hakkınıza eklenmiştir.${input.note?.trim()?`\n\n📝 ${input.note.trim()}`:""}\n\n*SPRİNT YÜZME OKULU*\nBilgilendirme Hattı: 0551 896 83 19`,oldEndDate:oldEnd,newEndDate:newEnd,giftDates});processed++;
  }
  revalidatePath("/hazir-mesajlar");revalidatePath("/ogrenciler");revalidatePath("/yoklama");
  return{ok:processed>0,message:`${processed} kursiyere hediye ders eklendi${skipped?`, ${skipped} kayıt atlandı`:""}.`,messages};
}
