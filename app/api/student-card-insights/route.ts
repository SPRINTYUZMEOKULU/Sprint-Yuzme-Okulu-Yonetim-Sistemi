import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";

const ROLES = ["owner","admin","branch_manager","registration_staff","accounting","coach"] as const;

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function n(v:unknown){const x=Number(v??0);return Number.isFinite(x)?x:0;}

export async function GET(request:NextRequest){
  try{
    const profile=await requireProfile([...ROLES]);
    const organizationId=profile.organization_id;
    if(!organizationId) return NextResponse.json({ok:false,error:"Organizasyon bilgisi bulunamadı."},{status:400});

    const ids=String(request.nextUrl.searchParams.get("ids")||"")
      .split(",").map((x)=>x.trim()).filter(Boolean).slice(0,100);
    if(!ids.length) return NextResponse.json({ok:true,items:[]});

    const admin=adminClient();
    const {data:students,error:studentError}=await admin.from("students")
      .select("id,first_name,last_name")
      .eq("organization_id",organizationId).in("id",ids);
    if(studentError) throw studentError;
    const validIds=(students||[]).map((s:any)=>String(s.id));
    if(!validIds.length) return NextResponse.json({ok:true,items:[]});

    const [{data:enrollments,error:enrollmentError},{data:followups,error:followupError}]=await Promise.all([
      admin.from("student_enrollments").select("id,student_id,package_id,payment_due_date,start_date,status,created_at")
        .eq("organization_id",organizationId).in("student_id",validIds).eq("status","active")
        .order("created_at",{ascending:false}),
      admin.from("student_absence_followups").select("id,student_id,first_absence_date,second_absence_date,status,contact_reason,created_at")
        .eq("organization_id",organizationId).in("student_id",validIds).eq("status","pending")
        .order("created_at",{ascending:false}),
    ]);
    if(enrollmentError) throw enrollmentError;
    if(followupError) throw followupError;

    const enrollmentMap=new Map<string,any>();
    for(const row of enrollments||[]){if(!enrollmentMap.has(String(row.student_id))) enrollmentMap.set(String(row.student_id),row);}
    const packageIds=[...new Set([...enrollmentMap.values()].map((x:any)=>String(x.package_id||"")).filter(Boolean))];
    const enrollmentIds=[...enrollmentMap.values()].map((x:any)=>String(x.id));

    const [packageResult,paymentResult]=await Promise.all([
      packageIds.length?admin.from("course_packages").select("id,name,price").eq("organization_id",organizationId).in("id",packageIds):Promise.resolve({data:[],error:null} as any),
      enrollmentIds.length?admin.from("student_payments").select("enrollment_id,amount,payment_status,cancelled_at").eq("organization_id",organizationId).in("enrollment_id",enrollmentIds):Promise.resolve({data:[],error:null} as any),
    ]);
    if(packageResult.error) throw packageResult.error;
    if(paymentResult.error) throw paymentResult.error;

    const packageMap=new Map<string,any>((packageResult.data||[]).map((x:any)=>[String(x.id),x] as [string,any]));
    const paidMap=new Map<string,number>();
    for(const row of paymentResult.data||[]){
      if(row.cancelled_at||row.payment_status==="cancelled") continue;
      const key=String(row.enrollment_id||"");
      paidMap.set(key,(paidMap.get(key)||0)+n(row.amount));
    }
    const followupMap=new Map<string,any>();
    for(const row of followups||[]){if(!followupMap.has(String(row.student_id))) followupMap.set(String(row.student_id),row);}

    const items=validIds.map((studentId)=>{
      const enrollment=enrollmentMap.get(studentId)||null;
      const pkg=enrollment?.package_id?packageMap.get(String(enrollment.package_id))||null:null;
      const total=n(pkg?.price);
      const paid=enrollment?.id?n(paidMap.get(String(enrollment.id))):0;
      const remaining=Math.max(0,total-paid);
      return {
        studentId,
        finance:{
          hasActiveEnrollment:Boolean(enrollment),
          packageName:pkg?.name||null,
          total,
          paid,
          remaining,
          dueDate:enrollment?.payment_due_date||enrollment?.start_date||null,
          status:enrollment?(remaining>0?(paid>0?"partial":"waiting"):"paid"):"unknown",
        },
        absenceFollowup:followupMap.get(studentId)||null,
      };
    });

    return NextResponse.json({ok:true,items});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Öğrenci kartı bilgileri alınamadı."},{status:500});
  }
}

export async function POST(request:NextRequest){
  try{
    const profile=await requireProfile([...ROLES]);
    const organizationId=profile.organization_id;
    if(!organizationId) return NextResponse.json({ok:false,error:"Organizasyon bilgisi bulunamadı."},{status:400});
    const body=await request.json();
    const followupId=String(body?.followupId||"");
    const reason=String(body?.reason||"").trim();
    if(!followupId||reason.length<3) return NextResponse.json({ok:false,error:"Arama/devamsızlık gerekçesini giriniz."},{status:400});

    const admin=adminClient();
    const {data:followup,error:findError}=await admin.from("student_absence_followups")
      .select("id,student_id,second_absence_date,status")
      .eq("id",followupId).eq("organization_id",organizationId).maybeSingle();
    if(findError) throw findError;
    if(!followup) return NextResponse.json({ok:false,error:"Devamsızlık takip kaydı bulunamadı."},{status:404});

    const now=new Date().toISOString();
    const {error:updateError}=await admin.from("student_absence_followups").update({
      status:"completed",contact_reason:reason,contacted_at:now,contacted_by:profile.id,updated_at:now,
    }).eq("id",followupId).eq("organization_id",organizationId);
    if(updateError) throw updateError;

    await admin.from("student_activity_logs").insert({
      organization_id:organizationId,student_id:followup.student_id,activity_type:"absence_followup_completed",
      title:"Devamsızlık araması tamamlandı",description:reason,source_type:"student_absence_followup",source_id:followupId,
      performed_by:profile.id,performed_at:now,created_at:now,
    });

    await admin.from("system_notifications").update({is_read:true,read_at:now})
      .eq("organization_id",organizationId).eq("source_type","student_absence_followup").eq("source_id",followupId);

    return NextResponse.json({ok:true,message:"Arama gerekçesi kaydedildi ve devamsızlık takibi kapatıldı."});
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Devamsızlık gerekçesi kaydedilemedi."},{status:500});
  }
}
