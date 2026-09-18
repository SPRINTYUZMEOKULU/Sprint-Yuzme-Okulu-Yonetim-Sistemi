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
    const {data:current}=await ctx.admin.from("student_compensation_lessons").select("id,student_id,status,lesson_date").eq("id",id).eq("organization_id",ctx.organizationId).maybeSingle();
    if(!current) return NextResponse.json({ok:false,error:"Telafi kaydı bulunamadı."},{status:404});
    if(current.status!=="planned") return NextResponse.json({ok:false,error:"Yalnızca bekleyen telafi iptal edilebilir."},{status:409});
    const now=new Date().toISOString();
    const {error}=await ctx.admin.from("student_compensation_lessons").update({status:"cancelled",updated_at:now}).eq("id",id).eq("organization_id",ctx.organizationId);
    if(error) return NextResponse.json({ok:false,error:error.message},{status:500});
    await ctx.admin.from("student_activity_logs").insert({organization_id:ctx.organizationId,student_id:current.student_id,activity_type:"compensation_cancelled",title:"Telafi iptal edildi",description:`${current.lesson_date||"Tarihsiz"} tarihli telafi yönetim tarafından iptal edildi.`,source_type:"student_compensation_lessons",source_id:id,performed_by:ctx.userId,performed_at:now});
    return NextResponse.json({ok:true,message:"Telafi iptal edildi."});
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
