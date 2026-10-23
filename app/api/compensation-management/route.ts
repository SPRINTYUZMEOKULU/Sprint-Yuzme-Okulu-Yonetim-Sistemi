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
  const {data:profile}=await admin.from("profiles").select("id,role,organization_id").eq("id",user.id).maybeSingle();
  if(!profile?.organization_id) return null;
  return {admin,userId:user.id,role:String(profile.role) as Role,organizationId:String(profile.organization_id)};
}

export async function GET(){
  try{
    const ctx=await context();
    if(!ctx||!manageRoles.includes(ctx.role)) return NextResponse.json({ok:false,error:"Yetkisiz."},{status:403});
    const {data:rows,error}=await ctx.admin.from("student_compensation_lessons")
      .select("id,student_id,enrollment_id,target_group_id,target_schedule_id,lesson_date,status,note,created_at,updated_at")
      .eq("organization_id",ctx.organizationId).in("status",["planned","cancelled"]).order("lesson_date",{ascending:true});
    if(error) return NextResponse.json({ok:false,error:error.message},{status:500});
    const ids=[...new Set((rows||[]).map((r:any)=>String(r.student_id)).filter(Boolean))];
    const {data:students}=ids.length?await ctx.admin.from("students").select("id,first_name,last_name,student_number").in("id",ids):{data:[] as any[]};
    const names=new Map((students||[]).map((s:any)=>[String(s.id),s]));
    return NextResponse.json({ok:true,canDelete:deleteRoles.includes(ctx.role),items:(rows||[]).map((r:any)=>({...r,student:names.get(String(r.student_id))||null}))});
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
    if(error) return NextResponse.json({ok:false,error:error.message},{status:500});
    if(!changed) return NextResponse.json({ok:false,error:"Kayıt değişmiş. Sayfayı yenileyin."},{status:409});
    const {error:logError}=await ctx.admin.from("student_activity_logs").insert({organization_id:ctx.organizationId,student_id:current.student_id,activity_type:moving?"compensation_rescheduled":"compensation_cancelled",title:moving?"Bireysel telafi planı değiştirildi":"Telafi iptal edildi",description:moving?`${current.lesson_date} tarihli telafi ${changes.lesson_date} tarihine taşındı.`:`${current.lesson_date} tarihli telafi iptal edildi.`,old_value:current,new_value:changes,source_type:"student_compensation_lessons",source_id:id,performed_by:ctx.userId,performed_at:now});
    for(const path of [`/ogrenciler/${current.student_id}`,"/yoklama","/telafi-yonetimi","/veli"]) revalidatePath(path);
    return NextResponse.json({ok:true,message:logError?"Telafi güncellendi; işlem geçmişi kaydedilemedi.":moving?"Telafi planı değiştirildi. Eski seanstan çıkarıldı; yeni seansa taşındı.":"Telafi iptal edildi."});
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
