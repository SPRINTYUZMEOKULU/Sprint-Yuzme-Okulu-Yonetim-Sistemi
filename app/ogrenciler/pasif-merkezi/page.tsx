import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import PassiveCenterClient, { type PassiveCenterStudent } from "./passive-center-client";

export const dynamic = "force-dynamic";

type SimpleRow={id:string;name:string};
type MembershipRow={student_id:string;group_id:string|null;started_at:string|null};

type RequestRow={
  id:string; student_id:string; reason:string|null; description:string|null; status:string|null;
  requested_at:string|null; created_at:string|null; reviewed_at:string|null; applied_at:string|null;
};

export default async function PassiveCenterPage(){
  const profile=await requireProfile(["owner","admin","branch_manager","registration_staff"]);
  const supabase=await createClient();
  const organizationId=profile.organization_id;

  const [studentsRes,branchesRes,groupsRes,membershipsRes,requestsRes]=await Promise.all([
    supabase.from("students").select("id,first_name,last_name,student_number,status,branch_id,phone,guardian_phone,created_at,is_deleted").eq("organization_id",organizationId).eq("is_deleted",false).in("status",["active","passive"]).order("first_name"),
    supabase.from("branches").select("id,name").eq("organization_id",organizationId),
    supabase.from("training_groups").select("id,name").eq("organization_id",organizationId),
    supabase.from("student_group_memberships").select("student_id,group_id,started_at").eq("organization_id",organizationId).eq("is_active",true).order("started_at",{ascending:false}),
    supabase.from("student_status_change_requests").select("id,student_id,reason,description,status,requested_at,created_at,reviewed_at,applied_at").eq("organization_id",organizationId).eq("request_type","deactivate").order("created_at",{ascending:false}),
  ]);

  const branchMap=new Map(((branchesRes.data||[]) as SimpleRow[]).map(x=>[x.id,x.name]));
  const groupMap=new Map(((groupsRes.data||[]) as SimpleRow[]).map(x=>[x.id,x.name]));
  const membershipMap=new Map<string,MembershipRow>();
  for(const row of (membershipsRes.data||[]) as MembershipRow[]){if(!membershipMap.has(row.student_id))membershipMap.set(row.student_id,row)}
  const requestMap=new Map<string,RequestRow>();
  for(const row of (requestsRes.data||[]) as RequestRow[]){if(!requestMap.has(row.student_id))requestMap.set(row.student_id,row)}

  const students:PassiveCenterStudent[]=((studentsRes.data||[]) as any[]).map(student=>{
    const membership=membershipMap.get(student.id);const req=requestMap.get(student.id);
    return {
      id:student.id,
      first_name:student.first_name||"",
      last_name:student.last_name||"",
      student_number:student.student_number||null,
      status:student.status||"active",
      branch_id:student.branch_id||null,
      branch_name:student.branch_id?branchMap.get(student.branch_id)||null:null,
      group_id:membership?.group_id||null,
      group_name:membership?.group_id?groupMap.get(membership.group_id)||null:null,
      phone:student.phone||null,
      guardian_phone:student.guardian_phone||null,
      passive_reason:student.status==="passive"?(req?.reason||null):null,
      passive_description:student.status==="passive"?(req?.description||null):null,
      passive_at:student.status==="passive"?(req?.applied_at||req?.reviewed_at||req?.created_at||null):null,
      request_status:req?.status||null,
    };
  });

  return <PassiveCenterClient students={students} canApprove={["owner","admin"].includes(profile.role)} />;
}
