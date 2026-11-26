import { currentMakeupNotice } from "@/lib/students/compensation-management";
import { revalidateStudentSurfaces } from "@/lib/students/revalidate";
import { compensationChangeMessage } from "@/lib/students/compensation-message";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Role = "owner"|"admin"|"branch_manager"|"registration_staff"|"accounting"|"coach"|"guardian"|"pending";
const manageRoles: Role[] = ["owner","admin","branch_manager"];
const deleteRoles: Role[] = ["owner","admin"];

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error("Supabase sunucu değişkenleri eksik.");
  return createAdminClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
async function context(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return null;
  const admin=adminClient();
  const {data:profile}=await admin.from("profiles").select("id,role,organization_id,is_active").eq("id",user.id).maybeSingle();
  if(!profile?.organization_id || !profile.is_active) return null;
  return {admin,userId:user.id,role:String(profile.role) as Role,organizationId:String(profile.organization_id)};
}

async function prepareChangeMessage(ctx: NonNullable<Awaited<ReturnType<typeof context>>>, current: any, changes: any) {
  const {data:student,error:studentError}=await ctx.admin.from("students").select("id,first_name,last_name,guardian_phone,phone").eq("organization_id",ctx.organizationId).eq("id",current.student_id).maybeSingle();
  if(studentError||!student) throw new Error("Mesaj için öğrenci bilgileri okunamadı.");
  async function plan(date:string,scheduleId:string|null,groupId:string|null){
    const {data:schedule,error:scheduleError}=scheduleId?await ctx.admin.from("lesson_schedules").select("start_time,end_time,group_id").eq("organization_id",ctx.organizationId).eq("id",scheduleId).maybeSingle():{data:null,error:null};
    if(scheduleError)throw scheduleError;
    const {data:group,error:groupError}=await ctx.admin.from("training_groups").select("name,branch_id").eq("organization_id",ctx.organizationId).eq("id",schedule?.group_id||groupId).maybeSingle();
    if(groupError)throw groupError;
    const {data:branch,error:branchError}=group?.branch_id?await ctx.admin.from("branches").select("name").eq("organization_id",ctx.organizationId).eq("id",group.branch_id).maybeSingle():{data:null,error:null};
    if(branchError)throw branchError;
    return {date,time:schedule?`${String(schedule.start_time).slice(0,5)}–${String(schedule.end_time).slice(0,5)}`:null,group:group?.name,branch:branch?.name};
  }
  const [previous,next]=await Promise.all([plan(current.lesson_date,current.target_schedule_id,current.target_group_id),changes.status==="cancelled"?Promise.resolve(null):plan(changes.lesson_date,changes.target_schedule_id,changes.target_group_id)]);
  const message=compensationChangeMessage([student.first_name,student.last_name].filter(Boolean).join(" "),previous,next,Boolean(current.reserved));
  let recipient=String(student.guardian_phone||student.phone||"").replace(/\D/g,"");
  if(recipient.length===11&&recipient.startsWith("0"))recipient=`90${recipient.slice(1)}`;
  else if(recipient.length===10)recipient=`90${recipient}`;
  if(!/^\d{10,15}$/.test(recipient))recipient="";
  const {data:log,error}=await ctx.admin.from("message_logs").insert({organization_id:ctx.organizationId,student_id:current.student_id,template_key:"compensation_plan_change",channel:"whatsapp",recipient:recipient||null,subject:next?"Telafi planı güncellendi":"Telafi planı iptal edildi",message_body:message,status:"prepared",prepared_by:ctx.userId,prepared_at:new Date().toISOString(),metadata:{compensation_id:current.id,source_path:"/compensation-management",previous_plan:previous,new_plan:next,current_plan:{date:changes.lesson_date||current.lesson_date,schedule_id:changes.target_schedule_id||current.target_schedule_id,cancelled:changes.status==="cancelled"},delivery_confirmation:"prepared"}}).select("id").single();
  if(error||!log)throw new Error("Telafi kaydedildi fakat mesaj hazırlanamadı.");
  return {id:log.id,body:message,recipient,status:"prepared"};
}

export async function GET(){
  try{
    const ctx=await context();
    if(!ctx||!manageRoles.includes(ctx.role)) return NextResponse.json({ok:false,error:"Yetkisiz."},{status:403});
    const org=ctx.organizationId;
    const [lessons,reserves,schedules,groups,branches,logs,changes]=await Promise.all([
      ctx.admin.from("student_compensation_lessons").select("id,student_id,enrollment_id,target_group_id,target_schedule_id,lesson_date,status,note,created_at,updated_at").eq("organization_id",org).in("status",["planned","cancelled","completed"]).order("lesson_date",{ascending:false}).limit(1000),
      ctx.admin.from("student_activity_logs").select("id,student_id,old_value,new_value,description").eq("organization_id",org).eq("activity_type","lesson_cancellation_compensation").eq("new_value->>compensation_mode","reserve").order("performed_at",{ascending:false}).limit(1000),
      ctx.admin.from("lesson_schedules").select("id,group_id,weekday,start_time,end_time,makeup_date").eq("organization_id",org).or("is_active.eq.true,makeup_date.not.is.null"),
      ctx.admin.from("training_groups").select("id,name,branch_id").eq("organization_id",org).eq("is_active",true),
      ctx.admin.from("branches").select("id,name").eq("organization_id",org).eq("is_active",true),
      ctx.admin.from("message_logs").select("id,message_body,recipient,status,metadata").eq("organization_id",org).eq("template_key","compensation_plan_change").in("status",["prepared","sent"]).order("prepared_at",{ascending:false}).limit(1000),
      ctx.admin.from("student_activity_logs").select("source_id").eq("organization_id",org).in("activity_type",["compensation_rescheduled","compensation_cancelled","compensation_reserved_planned"]).limit(1000),
    ]);
    const error=[lessons,reserves,schedules,groups,branches,logs,changes].find(result=>result.error)?.error;
    if(error) return NextResponse.json({ok:false,error:"Telafi yönetimi verileri doğrulanamadı. Lütfen yeniden deneyin."},{status:500});
    const pending=(reserves.data||[]).filter((row:any)=>!row.new_value?.compensation_date).map((row:any)=>({id:row.id,student_id:row.student_id,lesson_date:null,status:"reserved",note:row.description,target_group_id:row.new_value?.group_id,source_date:row.old_value?.cancelled_lesson_date}));
    const all=[...(lessons.data||[]),...pending];
    const ids=[...new Set(all.map((r:any)=>String(r.student_id)))];
    const names=new Map<string,any>();
    for(let offset=0;offset<ids.length;offset+=100){
      const students=await ctx.admin.from("students").select("id,first_name,last_name,student_number").eq("organization_id",org).in("id",ids.slice(offset,offset+100));
      if(students.error) return NextResponse.json({ok:false,error:"Kursiyer bilgileri alınamadı."},{status:500});
      for(const student of students.data||[])names.set(String(student.id),student);
    }
    const activeBranches=new Set((branches.data||[]).map((row:any)=>row.id));
    const activeGroups=(groups.data||[]).filter((row:any)=>activeBranches.has(row.branch_id));
    return NextResponse.json({ok:true,canDelete:deleteRoles.includes(ctx.role),schedules:schedules.data,groups:activeGroups,branches:branches.data,
      truncated:[lessons,reserves,logs,changes].some(result=>(result.data||[]).length>=1000),
      items:all.map((row:any)=>({...row,student:names.get(String(row.student_id))||null,notification:currentMakeupNotice(row,logs.data||[]),canPrepare:(changes.data||[]).some((event:any)=>event.source_id===row.id)}))});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Telafiler alınamadı."},{status:500});}
}

export async function PATCH(request:NextRequest){
  try{
    const ctx=await context();
    if(!ctx||!manageRoles.includes(ctx.role)) return NextResponse.json({ok:false,error:"Yetkisiz."},{status:403});
    const body=await request.json(); const id=String(body?.id||"");
    if(!id) return NextResponse.json({ok:false,error:"Telafi kaydı seçilmedi."},{status:400});
    const {data:current}=await ctx.admin.from("student_compensation_lessons").select("id,student_id,status,lesson_date,target_group_id,target_schedule_id,updated_at").eq("id",id).eq("organization_id",ctx.organizationId).maybeSingle();
    if(!current) return NextResponse.json({ok:false,error:"Telafi kaydı bulunamadı."},{status:404});
    if(current.status!=="planned") return NextResponse.json({ok:false,error:"Yalnızca bekleyen telafi iptal edilebilir."},{status:409});
    const moving=body.action === "reschedule";
    if(body.action && !["reschedule","cancel"].includes(body.action)) return NextResponse.json({ok:false,error:"Geçersiz işlem."},{status:400});
    const now=new Date().toISOString();
    let changes: Record<string, unknown>={status:"cancelled",updated_at:now};
    if(moving){
      const date=String(body.lesson_date||""), scheduleId=String(body.target_schedule_id||"");
      const parsed=new Date(`${date}T12:00:00Z`);
      const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date<today)
        return NextResponse.json({ok:false,error:"Bugün veya ileri bir tarih seçin."},{status:400});
      const {data:schedule}=await ctx.admin.from("lesson_schedules").select("id,group_id,weekday,start_time").eq("id",scheduleId).eq("organization_id",ctx.organizationId).eq("is_active",true).maybeSingle();
      if(!schedule || (Number(schedule.weekday)%7)!==parsed.getUTCDay()) return NextResponse.json({ok:false,error:"Seans seçilen günle eşleşmiyor."},{status:400});
      const {data:group}=await ctx.admin.from("training_groups").select("id").eq("id",schedule.group_id).eq("organization_id",ctx.organizationId).eq("is_active",true).maybeSingle();
      if(!group) return NextResponse.json({ok:false,error:"Aktif grup bulunamadı."},{status:400});
      const {data:duplicate,error:duplicateError}=await ctx.admin.from("student_compensation_lessons").select("id").eq("organization_id",ctx.organizationId).eq("student_id",current.student_id).eq("lesson_date",date).eq("target_schedule_id",scheduleId).in("status",["planned","completed"]).neq("id",id).limit(1);
      if(duplicateError) throw duplicateError;
      if(duplicate?.length) return NextResponse.json({ok:false,error:"Bu seansa zaten telafi eklenmiş."},{status:409});
      const {data:attendance,error:attendanceError}=await ctx.admin.from("attendance_records").select("id").eq("organization_id",ctx.organizationId).eq("student_id",current.student_id).eq("lesson_date",date).eq("schedule_id",scheduleId).limit(1);
      if(attendanceError) throw attendanceError;
      if(attendance?.length) return NextResponse.json({ok:false,error:"Bu seansta yoklama kaydı var. Önce yoklamayı kontrol edin."},{status:409});
      changes={lesson_date:date,target_schedule_id:scheduleId,target_group_id:schedule.group_id,updated_at:now};
    }
    // One row update keeps the source right and bulk peers intact; no extra credit is created.
    let mutation=ctx.admin.from("student_compensation_lessons").update(changes).eq("id",id).eq("organization_id",ctx.organizationId).eq("status","planned");
    if(current.updated_at) mutation=mutation.eq("updated_at",current.updated_at);
    const {data:changed,error}=await mutation.select("id").maybeSingle();
    if(error) return NextResponse.json({ok:false,error:error.message},{status:error.code==="P0001"?409:500});
    if(!changed) return NextResponse.json({ok:false,error:"Kayıt değişmiş. Sayfayı yenileyin."},{status:409});
    const {error:logError}=await ctx.admin.from("student_activity_logs").insert({organization_id:ctx.organizationId,student_id:current.student_id,activity_type:moving?"compensation_rescheduled":"compensation_cancelled",title:moving?"Bireysel telafi planı değiştirildi":"Telafi iptal edildi",description:moving?`${current.lesson_date} tarihli telafi ${changes.lesson_date} tarihine taşındı.`:`${current.lesson_date} tarihli telafi iptal edildi.`,old_value:current,new_value:changes,source_type:"student_compensation_lessons",source_id:id,performed_by:ctx.userId,performed_at:now});
    // Supersede unsent change notices, so old plans cannot be confirmed as current.
    const {error:supersedeError}=await ctx.admin.from("message_logs").update({status:"cancelled"}).eq("organization_id",ctx.organizationId).eq("student_id",current.student_id).eq("template_key","compensation_plan_change").eq("metadata->>compensation_id",id).eq("status","prepared");
    let notification=null, messageWarning=supersedeError?" Önceki mesaj durumu güncellenemedi; eski mesajı göndermeyin.":"";
    if(body.prepare_message === true){
      try{notification=await prepareChangeMessage(ctx,current,changes);}catch{messageWarning=" Telafi kaydedildi; mesaj hazırlanamadı. Mesajı tekrar hazırlayabilirsiniz.";}
    }
    revalidateStudentSurfaces(current.student_id);
    return NextResponse.json({ok:true,notification,messageWarning,message:logError?"Telafi güncellendi; işlem geçmişi kaydedilemedi.":moving?"Telafi planı değiştirildi. Eski seanstan çıkarıldı; yeni seansa taşındı.":"Telafi iptal edildi."});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"İptal işlemi başarısız."},{status:500});}
}

export async function DELETE(request:NextRequest){
  try{
    const ctx=await context();
    if(!ctx||!deleteRoles.includes(ctx.role)) return NextResponse.json({ok:false,error:"Kalıcı silme yalnızca kurucu yönetici/yönetici yetkisindedir."},{status:403});
    const id=String(new URL(request.url).searchParams.get("id")||"");
    if(!id) return NextResponse.json({ok:false,error:"Telafi kaydı seçilmedi."},{status:400});
    const {data:current}=await ctx.admin.from("student_compensation_lessons").select("id,student_id,status,lesson_date").eq("id",id).eq("organization_id",ctx.organizationId).maybeSingle();
    if(!current) return NextResponse.json({ok:false,error:"Telafi kaydı bulunamadı."},{status:404});
    if(current.status!=="cancelled") return NextResponse.json({ok:false,error:"Kalıcı silme için önce telafiyi iptal edin."},{status:409});
    const {error}=await ctx.admin.from("student_compensation_lessons").delete().eq("id",id).eq("organization_id",ctx.organizationId).eq("status","cancelled");
    if(error) return NextResponse.json({ok:false,error:error.message},{status:500});
    await ctx.admin.from("student_activity_logs").insert({organization_id:ctx.organizationId,student_id:current.student_id,activity_type:"compensation_deleted",title:"İptal edilmiş telafi kalıcı silindi",description:`${current.lesson_date||"Tarihsiz"} tarihli iptal edilmiş telafi kalıcı olarak silindi.`,source_type:"student_compensation_lessons",source_id:id,performed_by:ctx.userId,performed_at:new Date().toISOString()});
    return NextResponse.json({ok:true,message:"İptal edilmiş telafi kalıcı olarak silindi."});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Silme işlemi başarısız."},{status:500});}
}

export async function POST(request:NextRequest){
 try{
  const ctx=await context();
  if(!ctx||!manageRoles.includes(ctx.role)) return NextResponse.json({ok:false,error:"Yetkisiz."},{status:403});
  const body=await request.json();
  if(body.action==="plan_reserved"){
    const date=String(body.lesson_date||""),id=String(body.id||"");
    let schedule=String(body.target_schedule_id||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!id||(!schedule&&!body.one_off))return NextResponse.json({ok:false,error:"Telafi hakkı, tarih ve seans seçin."},{status:400});
    if(body.one_off){
      const {start,end}=body.one_off;
      if(typeof start!=="string" || typeof end!=="string" || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start>=end)
        return NextResponse.json({ok:false,error:"Geçerli bir başlangıç ve bitiş saati girin."},{status:400});
      const reserve=await ctx.admin.from("student_activity_logs").select("new_value,old_value")
        .eq("organization_id",ctx.organizationId).eq("id",id).eq("activity_type","lesson_cancellation_compensation")
        .eq("new_value->>compensation_mode","reserve").maybeSingle();
      if(reserve.error||!reserve.data?.new_value?.group_id||reserve.data.new_value.compensation_date||date<=reserve.data.old_value?.cancelled_lesson_date)
        return NextResponse.json({ok:false,error:"Planlanabilir bir saklı hak ve iptalden sonraki bir tarih seçin."},{status:409});
      const db=await createClient();
      const target=await db.rpc("ensure_one_off_makeup_session",{p_group:reserve.data.new_value.group_id,p_date:date,p_start:start,p_end:end});
      if(target.error||!target.data?.id)return NextResponse.json({ok:false,error:target.error?.message||"Tek seferlik telafi seansı oluşturulamadı."},{status:409});
      schedule=target.data.id;
    }
    const {data,error}=await ctx.admin.rpc("plan_reserved_compensation",{p_actor:ctx.userId,p_log:id,p_date:date,p_schedule:schedule});
    if(error)return NextResponse.json({ok:false,error:error.message},{status:409});
    let notification=null,messageWarning="";
    if(body.prepare_message!==false&&!data.duplicate){
      try{notification=await prepareChangeMessage(ctx,data.previous,data.current);}catch{messageWarning=" Plan kaydedildi; mesaj hazırlanamadı. Son değişikliğin mesajını tekrar hazırlayabilirsiniz.";}
    }
    revalidateStudentSurfaces(data.student_id);
    return NextResponse.json({ok:true,notification,messageWarning,message:data.duplicate?"Bu hak zaten planlanmış. Güncel telafiyi kontrol edin.":"Saklı telafi hakkı planlandı. Toplam ders hakkı korunmuştur."});
  }
  if(body.action==="prepare"){
    const {data:current}=await ctx.admin.from("student_compensation_lessons").select("*").eq("organization_id",ctx.organizationId).eq("id",String(body.id||"")).maybeSingle();
    if(!current)return NextResponse.json({ok:false,error:"Telafi bulunamadı."},{status:404});
    const {data:event}=await ctx.admin.from("student_activity_logs").select("old_value,new_value").eq("organization_id",ctx.organizationId).eq("student_id",current.student_id).eq("source_id",current.id).in("activity_type",["compensation_rescheduled","compensation_cancelled","compensation_reserved_planned"]).order("performed_at",{ascending:false}).limit(1).maybeSingle();
    if(!event?.old_value||!event.new_value)return NextResponse.json({ok:false,error:"Son telafi değişikliği bulunamadı."},{status:404});
    if((event.new_value.status==="cancelled"&&current.status!=="cancelled")||(event.new_value.lesson_date&&current.lesson_date!==event.new_value.lesson_date)||(event.new_value.target_schedule_id&&current.target_schedule_id!==event.new_value.target_schedule_id))return NextResponse.json({ok:false,error:"Telafi planı yeniden değişmiş. Sayfayı yenileyin."},{status:409});
    const notification=await prepareChangeMessage(ctx,event.old_value,event.new_value);
    revalidatePath(`/ogrenciler/${current.student_id}`);
    return NextResponse.json({ok:true,notification});
  }
  if(body.action!=="confirm_sent")return NextResponse.json({ok:false,error:"Geçersiz mesaj işlemi."},{status:400});
  const {data:log}=await ctx.admin.from("message_logs").select("id,student_id,status,metadata").eq("organization_id",ctx.organizationId).eq("id",String(body.message_id||"")).eq("template_key","compensation_plan_change").maybeSingle();
  if(!log)return NextResponse.json({ok:false,error:"Mesaj bulunamadı."},{status:404});
  if(log.status==="sent")return NextResponse.json({ok:true,message:"Mesaj zaten gönderildi olarak kayıtlı."});
  if(log.status!=="prepared")return NextResponse.json({ok:false,error:"Mesaj durumu değişmiş. Sayfayı yenileyin."},{status:409});
  const {data:currentPlan}=await ctx.admin.from("student_compensation_lessons").select("lesson_date,target_schedule_id,status").eq("organization_id",ctx.organizationId).eq("id",String(log.metadata?.compensation_id||"")).maybeSingle();
  const expected=log.metadata?.current_plan;
  if(!currentPlan||!expected||Boolean(expected.cancelled)!==(currentPlan.status==="cancelled")||currentPlan.lesson_date!==expected.date||currentPlan.target_schedule_id!==expected.schedule_id)
    return NextResponse.json({ok:false,error:"Telafi planı yeniden değişmiş. Güncel mesajı hazırlayıp kontrol edin."},{status:409});
  const {data:changed,error}=await ctx.admin.from("message_logs").update({status:"sent",sent_by:ctx.userId,sent_at:new Date().toISOString(),metadata:{...log.metadata,delivery_confirmation:"staff_confirmed"}}).eq("organization_id",ctx.organizationId).eq("id",log.id).eq("status","prepared").select("id").maybeSingle();
  if(error||!changed)return NextResponse.json({ok:false,error:"Mesaj durumu kaydedilemedi. Kontrol edip tekrar deneyin."},{status:409});
  for(const path of [`/ogrenciler/${log.student_id}`,"/veli-mesajlar"])revalidatePath(path);
  return NextResponse.json({ok:true,message:"Gönderildi olarak kaydedildi."});
 }catch{return NextResponse.json({ok:false,error:"Mesaj işlemi tamamlanamadı."},{status:500});}
}
