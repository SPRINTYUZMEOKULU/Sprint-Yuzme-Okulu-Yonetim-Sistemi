import { redirect } from "next/navigation";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import RenewalStatusCenterClient, { type CenterItem, type RenewalApproval, type RenewalHistory } from "./renewal-status-center-client";

export const dynamic = "force-dynamic";

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}
function isoDateInIstanbul(date=new Date()){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
function addDays(value:string,days:number){const d=new Date(`${value}T12:00:00+03:00`);d.setDate(d.getDate()+days);return isoDateInIstanbul(d)}

export default async function RenewalOperationsPage(){
  const profile=await requireProfile(["owner","admin","branch_manager","registration_staff","accounting"]);
  if(!profile.organization_id) redirect("/");
  const organizationId=profile.organization_id;
  const supabase=await createClient();

  const [studentsRes,branchesRes,groupsRes,membershipsRes,enrollmentsRes,balanceRes,statusRequestsRes,activityResult,approvalResult]=await Promise.all([
    supabase.from("students").select("id,first_name,last_name,student_number,status,branch_id,is_deleted").eq("organization_id",organizationId).eq("is_deleted",false).in("status",["active","passive"]),
    supabase.from("branches").select("id,name").eq("organization_id",organizationId),
    supabase.from("training_groups").select("id,name").eq("organization_id",organizationId),
    supabase.from("student_group_memberships").select("student_id,group_id,started_at,is_active").eq("organization_id",organizationId).eq("is_active",true).order("started_at",{ascending:false}),
    supabase.from("student_enrollments").select("id,student_id,total_lessons,used_lessons,start_date,planned_end_date,status,created_at").eq("organization_id",organizationId).order("created_at",{ascending:false}),
    supabase.from("student_lesson_balance").select("student_id,compensation_lesson_balance"),
    supabase.from("student_status_change_requests").select("student_id,status,request_type,reason,description,created_at,reviewed_at,applied_at").eq("organization_id",organizationId).order("created_at",{ascending:false}),
    supabase.from("student_activity_logs").select("id,student_id,title,description,new_value,performed_at").eq("organization_id",organizationId).eq("activity_type","registration_renewed").order("performed_at",{ascending:false}).limit(250),
    supabase.from("approval_requests").select("id,student_id,status,new_values,metadata,requested_at,created_at,reviewed_at").eq("organization_id",organizationId).eq("request_type","registration_custom_lesson_count").order("created_at",{ascending:false}).limit(250),
  ]);

  const branches=new Map(((branchesRes.data||[]) as any[]).map(x=>[x.id,x.name]));
  const groups=new Map(((groupsRes.data||[]) as any[]).map(x=>[x.id,x.name]));
  const memberships=new Map<string,any>();
  for(const row of (membershipsRes.data||[]) as any[]){if(!memberships.has(row.student_id))memberships.set(row.student_id,row)}
  const enrollments=new Map<string,any>();
  for(const row of (enrollmentsRes.data||[]) as any[]){if(!enrollments.has(row.student_id))enrollments.set(row.student_id,row)}
  const balances=new Map(((balanceRes.data||[]) as any[]).map(x=>[x.student_id,Number(x.compensation_lesson_balance||0)]));
  const latestStatusRequest=new Map<string,any>();
  for(const row of (statusRequestsRes.data||[]) as any[]){if(!latestStatusRequest.has(row.student_id))latestStatusRequest.set(row.student_id,row)}
  const lastRenewed=new Map<string,string>();
  for(const row of (activityResult.data||[]) as any[]){if(row.student_id&&!lastRenewed.has(row.student_id)&&row.performed_at)lastRenewed.set(row.student_id,row.performed_at)}

  const today=isoDateInIstanbul();
  const soonDate=addDays(today,14);
  const items:CenterItem[]=((studentsRes.data||[]) as any[]).map(student=>{
    const enrollment=enrollments.get(student.id);
    const total=Number(enrollment?.total_lessons||0);
    const used=Number(enrollment?.used_lessons||0);
    const compensation=Number(balances.get(student.id)||0);
    const remaining=Math.max(total-used,0)+Math.max(compensation,0);
    const endDate=enrollment?.planned_end_date||null;
    const membership=memberships.get(student.id);
    const statusRequest=latestStatusRequest.get(student.id);
    const endedByRights=student.status==="active"&&total>0&&remaining<=0;
    const endedByDate=student.status==="active"&&Boolean(endDate&&endDate<=today);
    const endingSoon=student.status==="active"&&!endedByRights&&!endedByDate&&((total>0&&remaining<=3)||Boolean(endDate&&endDate<=soonDate));
    const category:CenterItem["category"]=student.status==="passive"?"passive":endedByRights||endedByDate?"action":endingSoon?"soon":"active";
    const reason=student.status==="passive"?"Pasif öğrenci":endedByRights?"Ders hakkı tamamlandı":endedByDate?"Kayıt dönemi sona erdi":endingSoon?"Kayıt yenilemesi yaklaşıyor":"Aktif kayıt";
    return {
      id:student.id,studentNumber:student.student_number||null,name:`${student.first_name||""} ${student.last_name||""}`.trim()||"Kursiyer",status:student.status==="passive"?"passive":"active",
      branchName:student.branch_id?branches.get(student.branch_id)||null:null,groupName:membership?.group_id?groups.get(membership.group_id)||null:null,totalLessons:total,usedLessons:used,remainingLessons:remaining,plannedEndDate:endDate,reason,category,
      passiveRequestPending:statusRequest?.request_type==="deactivate"&&statusRequest?.status==="pending",passiveReason:student.status==="passive"?(statusRequest?.reason||null):null,passiveAt:student.status==="passive"?(statusRequest?.applied_at||statusRequest?.reviewed_at||statusRequest?.created_at||null):null,lastRenewedAt:lastRenewed.get(student.id)||null,
    };
  }).sort((a,b)=>{
    const rank=(x:CenterItem)=>x.category==="action"?0:x.category==="soon"?1:x.category==="passive"?2:3;
    return rank(a)-rank(b)||String(a.plannedEndDate||"9999-12-31").localeCompare(String(b.plannedEndDate||"9999-12-31"))||a.name.localeCompare(b.name,"tr");
  });

  const studentMap=new Map(((studentsRes.data||[]) as any[]).map(x=>[x.id,`${x.first_name||""} ${x.last_name||""}`.trim()||"Öğrenci"]));
  const history:RenewalHistory[]=((activityResult.data||[]) as any[]).map(row=>{const next=asObject(row.new_value);return {id:row.id,studentId:row.student_id||null,studentName:studentMap.get(row.student_id)||"Öğrenci",lessonCount:Number(next.lesson_count||next.total_lessons||0)||null,performedAt:row.performed_at||null,description:row.description||row.title||null}});

  const approvals:RenewalApproval[]=((approvalResult.data||[]) as any[]).flatMap(row=>{
    const metadata=asObject(row.metadata);if(metadata.source!=="student_renewal_center")return[];
    const isOpen=row.status==="pending"||(row.status==="approved"&&!metadata.consumed_at);if(!isOpen)return[];
    const next=asObject(row.new_values);
    return [{id:row.id,studentId:row.student_id||null,studentName:studentMap.get(row.student_id)||"Öğrenci",status:row.status==="approved"?"approved":"pending",lessonCount:Number(next.total_lessons||0)||null,requestedAt:row.requested_at||row.created_at||null,reviewedAt:row.reviewed_at||null}];
  });

  return <><UstGezinme/><RenewalStatusCenterClient items={items} history={history} approvals={approvals} canApprove={["owner","admin"].includes(profile.role)}/></>;
}
