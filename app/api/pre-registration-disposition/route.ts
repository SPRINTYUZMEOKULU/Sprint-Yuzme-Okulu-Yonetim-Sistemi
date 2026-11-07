import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { disposeCandidate, getCandidate, REJECTION_MESSAGE } from "@/lib/registrations/disposition";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const profile = await requireProfile(["owner","admin"]);
  try {
    if (!profile.organization_id) throw new Error("Kurum bilgisi bulunamadı.");
    const studentId = request.nextUrl.searchParams.get("studentId") || "";
    if (!uuid.test(studentId)) throw new Error("Başvuru kimliği geçersiz.");
    const client = await createClient();
    const student = await getCandidate(client,profile.organization_id,studentId);
    let phone = String(student.guardian_phone || student.phone || "").replace(/\D/g,"");
    if (phone.startsWith("0")) phone = `90${phone.slice(1)}`;
    else if (phone.length === 10) phone = `90${phone}`;
    return NextResponse.json({ok:true,phone,message:REJECTION_MESSAGE},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return NextResponse.json({ok:false,message:error instanceof Error ? error.message : "Başvuru okunamadı."},{status:400}); }
}

export async function POST(request: NextRequest) {
  const profile = await requireProfile(["owner","admin"]);
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ok:false,message:"Geçersiz istek kaynağı."},{status:403});
  try {
    if (!profile.organization_id) throw new Error("Kurum bilgisi bulunamadı.");
    const body = await request.json();
    if (!uuid.test(body.studentId || "")) throw new Error("Başvuru kimliği geçersiz.");
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("İşlem servisi yapılandırılmamış.");
    const client=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    if (body.action === "prepare_rejection" || body.action === "confirm_rejection") {
      const student = await getCandidate(client,profile.organization_id,body.studentId);
      if (!uuid.test(body.messageId || "")) throw new Error("Mesaj kimliği geçersiz.");
      let phone=String(student.guardian_phone || student.phone || "").replace(/\D/g,"");
      if (phone.startsWith("0")) phone=`90${phone.slice(1)}`; else if(phone.length===10) phone=`90${phone}`;
      if (phone.length < 10 || phone.length > 15) throw new Error("Geçerli iletişim telefonu bulunamadı.");
      const existing=await client.from("message_logs").select("id,status,metadata")
        .eq("organization_id",profile.organization_id).eq("student_id",body.studentId).eq("id",body.messageId).maybeSingle();
      if(existing.error) throw new Error("Mesaj geçmişi kontrol edilemedi.");
      const confirmed=body.action==="confirm_rejection";
      if (confirmed && !existing.data) throw new Error("Önce ret mesajını WhatsApp’ta açın.");
      if (confirmed) {
        const result=await client.from("message_logs").update({status:"sent",sent_by:profile.id,sent_at:new Date().toISOString(),
          metadata:{...existing.data?.metadata,delivery_confirmation:"manual_confirmed",confirmed_by:profile.id}})
          .eq("organization_id",profile.organization_id).eq("student_id",body.studentId).eq("id",body.messageId).eq("template_key","registration_rejected").select("id").maybeSingle();
        if(result.error || !result.data) throw new Error("Gönderim onayı kaydedilemedi.");
      } else if (!existing.data) {
        const result=await client.from("message_logs").insert({id:body.messageId,organization_id:profile.organization_id,student_id:body.studentId,
          template_key:"registration_rejected",subject:"Başvuru ret bildirimi",channel:"whatsapp",recipient:phone,
          message_body:REJECTION_MESSAGE,status:"prepared",prepared_by:profile.id,metadata:{source:"pre_registration_disposition",delivery_confirmation:"prepared"}});
        if(result.error) throw new Error("Ret mesajı hazırlanamadı.");
      }
      return NextResponse.json({ok:true,phone,message:REJECTION_MESSAGE});
    }
    const result=await disposeCandidate(client,{id:profile.id,organization_id:profile.organization_id},{
      studentId:body.studentId,action:String(body.action || ""),reason:String(body.reason || "").slice(0,500),
      confirmed:body.confirmed===true,messageId:body.messageId,deletionText:body.deletionText});
    for(const path of ["/ogrenciler","/on-kayitlar","/on-kayitlar/gerceklesmeyen","/kesin-kayit-merkezi","/onay-merkezi","/"]) revalidatePath(path);
    revalidatePath(`/ogrenciler/${body.studentId}`);
    return NextResponse.json({ok:true,...result});
  } catch(error) { return NextResponse.json({ok:false,message:error instanceof Error ? error.message : "İşlem tamamlanamadı."},{status:400}); }
}
