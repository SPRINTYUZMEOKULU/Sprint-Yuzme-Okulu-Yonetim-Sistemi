"use server";

import { createHash } from "node:crypto";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type MakeupReminder = { id:string; studentId:string; name:string; time:string; branch:string; message:string; recipient:string|null; messageId:string; sent:boolean };
const roles = ["owner","admin","branch_manager","registration_staff"] as const;
function clock() {
  const parts = new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
  return {date:parts.slice(0,10),time:parts.slice(11,16)};
}
async function eligible(db:any, org:string) {
  const now=clock();
  const results=await Promise.all([
    db.from("student_compensation_lessons").select("id,student_id,enrollment_id,target_group_id,target_schedule_id,lesson_date,status").eq("organization_id",org).eq("lesson_date",now.date).eq("status","planned"),
    db.from("students").select("id,first_name,last_name,phone,guardian_phone").eq("organization_id",org).eq("status","active").eq("is_active",true).eq("is_deleted",false),
    db.from("lesson_schedules").select("id,group_id,start_time,end_time").eq("organization_id",org).eq("is_active",true),
    db.from("training_groups").select("id,name,branch_id,course_type").eq("organization_id",org).eq("is_active",true),
    db.from("branches").select("id,name").eq("organization_id",org).eq("is_active",true),
    db.from("student_activity_logs").select("student_id,source_id").eq("organization_id",org).eq("activity_type","lesson_cancellation_compensation").eq("old_value->>cancelled_lesson_date",now.date),
  ]);
  const failure=results.find(r=>r.error); if(failure) throw new Error("Bugünkü telafi bilgileri doğrulanamadı: "+failure.error.message);
  const [lessons,students,schedules,groups,branches,cancelled]=results.map(r=>r.data||[]);
  const rows:MakeupReminder[]=[];
  for(const lesson of lessons) {
    const student=students.find((s:any)=>s.id===lesson.student_id);
    const schedule=schedules.find((s:any)=>s.id===lesson.target_schedule_id);
    const group=groups.find((g:any)=>g.id===lesson.target_group_id&&g.id===schedule?.group_id);
    const branch=branches.find((b:any)=>b.id===group?.branch_id);
    if(!student||!schedule||!group||!branch||!schedule.start_time||!schedule.end_time||String(schedule.end_time).slice(0,5)<=now.time
      ||cancelled.some((c:any)=>c.student_id===lesson.student_id&&c.source_id===lesson.target_schedule_id))continue;
    const name=[student.first_name,student.last_name].filter(Boolean).join(" ");
    const adult=/yetişkin|yetiskin|adult|master/i.test(group.course_type||"");
    let phone=String((adult?student.phone||student.guardian_phone:student.guardian_phone||student.phone)||"").replace(/\D/g,"");
    if(phone.length===11&&phone.startsWith("0"))phone="90"+phone.slice(1);else if(phone.length===10)phone="90"+phone;
    const time=String(schedule.start_time).slice(0,5)+"–"+String(schedule.end_time).slice(0,5);
    const message=`*SPRİNT YÜZME OKULU | TELAFİ HATIRLATMASI*\n\nDeğerli ${adult?"Kursiyerimiz":"Velimiz"},\n\n*${name}* için *bugün (${now.date.split("-").reverse().join(".")}) saat ${time}* telafi dersimiz vardır.\n\n*Havuz:* ${branch.name}\n*Grup:* ${group.name}\n\nDers saatinden önce hazır bulunmanızı rica ederiz.\n*Sprint Yüzme Okulu Yönetimi*`;
    const hash=createHash("sha256").update([org,lesson.id,lesson.lesson_date,schedule.id,message].join(":" )).digest("hex");
    const messageId=`${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    rows.push({id:lesson.id,studentId:student.id,name,time,branch:branch.name,message,recipient:/^\d{10,15}$/.test(phone)?phone:null,messageId,sent:false});
  }
  return rows.sort((a,b)=>a.time.localeCompare(b.time)||a.name.localeCompare(b.name,"tr"));
}

export async function loadTodayMakeupReminders() {
  const profile=await requireProfile([...roles]);
  if(!profile.organization_id)throw new Error("Organizasyon bilgisi bulunamadı.");
  const db=await createClient(); const rows=await eligible(db,profile.organization_id);
  if(!rows.length)return rows;
  const logs=await db.from("message_logs").select("id,status").eq("organization_id",profile.organization_id).eq("template_key","compensation_day_reminder").in("id",rows.map(r=>r.messageId));
  if(logs.error)throw new Error("Hatırlatma gönderim geçmişi okunamadı.");
  return rows.map(row=>({...row,sent:!!logs.data?.some(log=>log.id===row.messageId&&["sent","delivered","read"].includes(log.status))}));
}

export async function makeupReminderAction(id:string, action:"prepare"|"confirm") {
  const profile=await requireProfile([...roles]); const org=profile.organization_id;
  if(!org||!["prepare","confirm"].includes(action))throw new Error("Geçersiz işlem.");
  const db=await createClient(); const row=(await eligible(db,org)).find(r=>r.id===id);
  if(!row)throw new Error("Telafi planı değişti, iptal edildi veya ders saati geçti. Listeyi yenileyin.");
  if(!row.recipient)throw new Error("Güncel telefon bilgisi eksik. Kursiyer dosyasından düzeltin.");
  const existing=await db.from("message_logs").select("id,status").eq("organization_id",org).eq("id",row.messageId).maybeSingle();
  if(existing.error)throw new Error("Gönderim geçmişi doğrulanamadı.");
  if(existing.data&&["sent","delivered","read"].includes(existing.data.status))return {...row,sent:true};
  if(action==="prepare") {
    if(!existing.data){
      const saved=await db.from("message_logs").insert({id:row.messageId,organization_id:org,student_id:row.studentId,template_key:"compensation_day_reminder",channel:"whatsapp",recipient:row.recipient,subject:"Bugün telafi dersiniz var",message_body:row.message,status:"prepared",prepared_by:profile.id,metadata:{compensation_id:row.id,lesson_date:clock().date,source_path:"/ders-operasyonlari",delivery_confirmation:"prepared"}});
      if(saved.error&&saved.error.code!=="23505")throw new Error("Hatırlatma hazırlanamadı.");
    }else if(existing.data.status!=="prepared")throw new Error("Mesaj durumu değişmiş. Listeyi yenileyin.");
  }else {
    if(!existing.data||existing.data.status!=="prepared")throw new Error("Önce güncel hatırlatmayı WhatsApp’ta açın.");
    const saved=await db.from("message_logs").update({status:"sent",sent_at:new Date().toISOString(),sent_by:profile.id,metadata:{compensation_id:row.id,lesson_date:clock().date,delivery_confirmation:"user_confirmed"}}).eq("organization_id",org).eq("id",row.messageId).eq("status","prepared").select("id");
    if(saved.error||!saved.data?.length)throw new Error("Gönderim onayı kaydedilemedi. Listeyi yenileyin.");
  }
  for(const path of ["/ders-operasyonlari","/telafi-yonetimi","/veli-mesajlar",`/ogrenciler/${row.studentId}`])revalidatePath(path);
  return {...row,sent:action==="confirm"};
}
