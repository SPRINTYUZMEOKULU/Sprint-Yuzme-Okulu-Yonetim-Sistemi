// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["owner","admin","branch_manager","registration_staff","accounting","coach"] as const;
export const dynamic = "force-dynamic";
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
function amount(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

async function syncPaymentDueNotifications(supabase: SupabaseClient, organizationId: string) {
  const today = new Date().toISOString().slice(0,10);
  const { data: enrollments, error: enrollmentError } = await supabase.from("student_enrollments").select("id,student_id,package_id,payment_due_date,status").eq("organization_id",organizationId).eq("status","active").not("payment_due_date","is",null).lte("payment_due_date",today).order("payment_due_date",{ascending:true}).limit(100);
  if (enrollmentError) { console.error("payment due enrollment lookup error:",enrollmentError); return; }
  const rows = enrollments || [];
  const enrollmentIds = rows.map((row:any)=>String(row.id));
  const studentIds = [...new Set(rows.map((row:any)=>String(row.student_id)).filter(Boolean))];
  const packageIds = [...new Set(rows.map((row:any)=>String(row.package_id||"")).filter(Boolean))];
  const [studentsResult,packagesResult,paymentsResult,existingResult] = await Promise.all([
    studentIds.length ? supabase.from("students").select("id,first_name,last_name").eq("organization_id",organizationId).in("id",studentIds) : Promise.resolve({data:[],error:null} as any),
    packageIds.length ? supabase.from("course_packages").select("id,name,price").eq("organization_id",organizationId).in("id",packageIds) : Promise.resolve({data:[],error:null} as any),
    enrollmentIds.length ? supabase.from("student_payments").select("id,enrollment_id,amount,payment_status").eq("organization_id",organizationId).in("enrollment_id",enrollmentIds).eq("payment_status","received") : Promise.resolve({data:[],error:null} as any),
    supabase.from("system_notifications").select("id,entity_id,is_read").eq("organization_id",organizationId).eq("event_key","payment_due").eq("is_read",false),
  ]);
  if (studentsResult.error || packagesResult.error || paymentsResult.error) { console.error("payment due finance lookup error:",studentsResult.error||packagesResult.error||paymentsResult.error); return; }
  const studentMap = new Map<string,any>((studentsResult.data||[]).map((row:any)=>[String(row.id),row]));
  const packageMap = new Map<string,any>((packagesResult.data||[]).map((row:any)=>[String(row.id),row]));
  const receivedByEnrollment = new Map<string,number>();
  for (const payment of paymentsResult.data||[]) { const key=String((payment as any).enrollment_id||""); receivedByEnrollment.set(key,(receivedByEnrollment.get(key)||0)+amount((payment as any).amount)); }
  const dueRows = rows.map((enrollment:any)=>{ const packageInfo=enrollment.package_id?packageMap.get(String(enrollment.package_id)):null; const total=amount(packageInfo?.price); const received=receivedByEnrollment.get(String(enrollment.id))||0; const remaining=Math.max(0,total-received); const student=studentMap.get(String(enrollment.student_id)); return {enrollment,packageInfo,student,total,received,remaining}; }).filter((item:any)=>item.total>0&&item.remaining>0);
  const activeDueIds = new Set(dueRows.map((item:any)=>String(item.enrollment.id)));
  const staleIds=(existingResult.data||[]).filter((row:any)=>!activeDueIds.has(String(row.entity_id||""))).map((row:any)=>row.id);
  if(staleIds.length) await supabase.from("system_notifications").update({is_read:true,read_at:new Date().toISOString()}).eq("organization_id",organizationId).in("id",staleIds);
  const existingDueIds=new Set((existingResult.data||[]).filter((row:any)=>activeDueIds.has(String(row.entity_id||""))).map((row:any)=>String(row.entity_id)));
  const inserts=dueRows.filter((item:any)=>!existingDueIds.has(String(item.enrollment.id))).map((item:any)=>{ const studentName=`${item.student?.first_name||""} ${item.student?.last_name||""}`.trim(); const remainingText=item.remaining.toLocaleString("tr-TR",{maximumFractionDigits:2}); return {organization_id:organizationId,recipient_profile_id:null,recipient_user_id:null,notification_type:"payment_due",category:"finance",event_key:"payment_due",title:"Ödeme vadesi geldi",body:`${studentName||"Öğrenci"} için ${remainingText} TL ödeme bekleniyor.`,message:`${studentName||"Öğrenci"} için ${remainingText} TL ödeme bekleniyor.`,priority:"high",severity:"warning",student_id:item.enrollment.student_id,source_type:"student_enrollment",source_id:item.enrollment.id,entity_type:"student_enrollment",entity_id:String(item.enrollment.id),target_path:`/ogrenciler/${item.enrollment.student_id}?payment=collect`,is_read:false,push_required:false,push_requested:false,metadata:{student_id:item.enrollment.student_id,enrollment_id:item.enrollment.id,payment_due_date:item.enrollment.payment_due_date,package_name:item.packageInfo?.name||null,total_amount:item.total,total_received:item.received,remaining_amount:item.remaining}}; });
  if(inserts.length){ const {error}=await supabase.from("system_notifications").insert(inserts); if(error) console.error("payment due notification insert error:",error); }
}

export async function GET(){
 try{
  const profile=await requireProfile([...ROLES]); if(!profile.organization_id) return NextResponse.json({ok:true,notifications:[]});
  const supabase=await createClient(); const manager=["owner","admin"].includes(String((profile as any).role||""));
  await syncPaymentDueNotifications(supabase,profile.organization_id);
  const recipientFilter=`recipient_profile_id.eq.${profile.id},recipient_user_id.eq.${profile.id},and(recipient_profile_id.is.null,recipient_user_id.is.null)`;
  const since=new Date(Date.now()-48*60*60*1000).toISOString(); const nowIso=new Date().toISOString();
  const [notificationResult,dueReminderResult]=await Promise.all([
   supabase.from("system_notifications").select("id,title,body,message,severity,priority,event_key,notification_type,target_path,student_id,entity_id,source_type,source_id,metadata,created_at,is_read,recipient_profile_id,recipient_user_id").eq("organization_id",profile.organization_id).eq("is_read",false).or(`created_at.gte.${since},notification_type.eq.registration_note_reminder,notification_type.eq.student_note_reminder,notification_type.eq.payment_due`).or(recipientFilter).order("created_at",{ascending:false}).limit(50),
   supabase.from("student_activity_logs").select("id,student_id,title,description,reminder_at,performed_by").eq("organization_id",profile.organization_id).in("activity_type",["registration_note","student_note_reminder"]).eq("reminder_completed",false).eq("performed_by",profile.id).not("reminder_at","is",null).lte("reminder_at",nowIso).order("reminder_at",{ascending:true}).limit(20),
  ]);
  const {data,error}=notificationResult; if(error) return NextResponse.json({ok:false,error:error.message},{status:500});
  const rows=data||[];
  const renewalApprovalIds=rows.filter((row:any)=>row.event_key==="registration_custom_lesson_count_approved"&&row.entity_id).map((row:any)=>row.entity_id as string);
  const approvalSource=new Map<string,string>();
  if(renewalApprovalIds.length){ const {data:approvals}=await supabase.from("approval_requests").select("id,metadata").eq("organization_id",profile.organization_id).in("id",renewalApprovalIds); for(const approval of approvals||[]){ const metadata=approval.metadata&&typeof approval.metadata==="object"?approval.metadata:{}; approvalSource.set(approval.id,String((metadata as any).source||"")); } }
  const statusSourceIds=rows.filter((row:any)=>row.source_type==="student_status"&&row.source_id).map((row:any)=>String(row.source_id)); const statusRequests=new Map<string,any>();
  if(statusSourceIds.length){ const {data:statusRows}=await supabase.from("student_status_change_requests").select("id,requested_by,request_type,requested_status,new_status,status,student_id").eq("organization_id",profile.organization_id).in("id",statusSourceIds); for(const item of statusRows||[]) statusRequests.set(String(item.id),item); }
  const now=Date.now();
  const visibleRows=rows.filter((row:any)=>{ if(["registration_note_reminder","student_note_reminder"].includes(row.notification_type)){ const reminderAt=row.metadata?.reminder_at; const reminderTime=reminderAt?new Date(reminderAt).getTime():Number.NaN; if(Number.isFinite(reminderTime)&&reminderTime>now)return false; } if(manager)return true; if(row.recipient_profile_id===profile.id||row.recipient_user_id===profile.id)return true; if(row.notification_type==="payment_due"&&["branch_manager","registration_staff","accounting"].includes(String((profile as any).role||"")))return true; if(row.notification_type==="student_status_approved"&&row.source_id){ const statusRequest=statusRequests.get(String(row.source_id)); return statusRequest?.requested_by===profile.id; } return false; });
  const scheduledNotifications=visibleRows.map((row:any)=>{ let targetPath=row.target_path||"/bildirimler"; if(row.notification_type==="registration_note_reminder"&&row.student_id)targetPath=`/ogrenciler/${row.student_id}#notlar`; if(row.notification_type==="payment_due"&&row.student_id)targetPath=`/ogrenciler/${row.student_id}?payment=collect`; if(row.event_key==="registration_custom_lesson_count_approved"&&row.student_id&&row.entity_id&&approvalSource.get(row.entity_id)==="student_renewal_center")targetPath=`/ogrenciler/${row.student_id}?renewalApproval=approved`; if(row.notification_type==="student_status_approved"&&row.source_id){ const statusRequest=statusRequests.get(String(row.source_id)); const targetStatus=String(statusRequest?.requested_status||statusRequest?.new_status||""); if(targetStatus==="passive"||statusRequest?.request_type==="deactivate")targetPath=`/onay-merkezi?status=approved&archiveRequestId=${encodeURIComponent(String(row.source_id))}`; } return {id:row.id,title:row.title||"SprintOS Bildirimi",body:row.body||row.message||"Yeni bir işlem bildirimi var.",severity:row.severity||"info",priority:row.priority||"normal",eventKey:row.event_key||null,targetPath,createdAt:row.created_at}; });
  const scheduledSourceIds=new Set(visibleRows.filter((row:any)=>row.source_type==="registration_note"&&row.source_id).map((row:any)=>String(row.source_id)));
  const fallbackReminders=(dueReminderResult.data||[]).filter((item:any)=>!scheduledSourceIds.has(String(item.id))).map((item:any)=>({id:`reminder:${item.id}`,title:item.title||"Öğrenci notu hatırlatması",body:item.description||"Takip zamanı gelen bir öğrenci notunuz var.",severity:"warning",priority:"normal",eventKey:"registration_note_reminder",targetPath:`/ogrenciler/${item.student_id}#notlar`,createdAt:item.reminder_at}));
  return NextResponse.json({ok:true,notifications:[...fallbackReminders,...scheduledNotifications].slice(0,12)});
 }catch(error){ return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Bildirimler alınamadı."},{status:500}); }
}

export async function POST(request:NextRequest){
 try{ const profile=await requireProfile([...ROLES]); const body=await request.json(); const id=String(body.id||""); if(!profile.organization_id||!id)return NextResponse.json({ok:false,error:"Bildirim bilgisi eksik."},{status:400}); const supabase=await createClient();
  if(id.startsWith("reminder:")){ const reminderId=id.slice("reminder:".length); const {error}=await supabase.from("student_activity_logs").update({reminder_completed:true,reminder_completed_at:new Date().toISOString()}).eq("organization_id",profile.organization_id).eq("id",reminderId).eq("performed_by",profile.id); if(error)return NextResponse.json({ok:false,error:error.message},{status:500}); return NextResponse.json({ok:true}); }
  const {error}=await supabase.from("system_notifications").update({is_read:true,read_at:new Date().toISOString()}).eq("organization_id",profile.organization_id).eq("id",id); if(error)return NextResponse.json({ok:false,error:error.message},{status:500}); return NextResponse.json({ok:true});
 }catch(error){ return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Bildirim güncellenemedi."},{status:500}); }
}
