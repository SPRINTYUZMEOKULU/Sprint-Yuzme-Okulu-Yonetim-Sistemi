// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
const ROLES=["owner","admin","branch_manager"] as const;
function validDate(v:string|null){return !!v&&/^\d{4}-\d{2}-\d{2}$/.test(v);}
function todayTR(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function weekday(date:string){const d=new Date(`${date}T12:00:00+03:00`);const n=d.getDay();return n===0?7:n;}
function eachDate(from:string,to:string){const out:string[]=[];let d=new Date(`${from}T12:00:00+03:00`);const end=new Date(`${to}T12:00:00+03:00`);for(let i=0;i<62&&d<=end;i++){out.push(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d));d=new Date(d.getTime()+86400000);}return out;}

export async function GET(req:NextRequest){
 try{
  const profile=await requireProfile([...ROLES]); const org=profile.organization_id; if(!org)return NextResponse.json({ok:true,items:[]});
  const url=new URL(req.url); const today=todayTR(); const monthStart=`${today.slice(0,7)}-01`; const from=validDate(url.searchParams.get("from"))?url.searchParams.get("from")!:monthStart; const to=validDate(url.searchParams.get("to"))?url.searchParams.get("to")!:today; const branch=url.searchParams.get("branch")||"all";
  const supabase=await createClient();
  const [schedulesResult,groupsResult,attendanceResult]=await Promise.all([
    supabase.from("lesson_schedules").select("id,group_id,branch_id,weekday,start_time,end_time,is_active").eq("organization_id",org).eq("is_active",true),
    supabase.from("training_groups").select("id,name,branch_id").eq("organization_id",org),
    supabase.from("attendance_records").select("id,schedule_id,group_id,lesson_date").eq("organization_id",org).gte("lesson_date",from).lte("lesson_date",to),
  ]);
  const error=schedulesResult.error||groupsResult.error||attendanceResult.error;if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  const groupMap=new Map((groupsResult.data||[]).map((g:any)=>[String(g.id),g]));
  const recordKeys=new Set((attendanceResult.data||[]).flatMap((r:any)=>[r.schedule_id?`${r.lesson_date}:${r.schedule_id}`:null,r.group_id?`${r.lesson_date}:g:${r.group_id}`:null].filter(Boolean)));
  const nowDate=today; const nowParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()); const gh=(t:string)=>nowParts.find(p=>p.type===t)?.value||"0"; const nowMinutes=Number(gh("hour"))*60+Number(gh("minute"));
  const items:any[]=[];
  for(const date of eachDate(from,to)){
    for(const s of schedulesResult.data||[]){
      if(Number(s.weekday)!==weekday(date))continue;
      const group=groupMap.get(String(s.group_id||"")); const effectiveBranch=s.branch_id||group?.branch_id||null; if(branch!=="all"&&effectiveBranch!==branch)continue;
      if(recordKeys.has(`${date}:${s.id}`)||recordKeys.has(`${date}:g:${s.group_id}`))continue;
      const [h,m]=String(s.start_time||"00:00").slice(0,5).split(":").map(Number); const start=(h||0)*60+(m||0);
      if(date>nowDate)continue; if(date===nowDate&&nowMinutes<start+15)continue;
      items.push({date,scheduleId:s.id,groupId:s.group_id,groupName:group?.name||"Grup",startTime:String(s.start_time||"").slice(0,5),endTime:String(s.end_time||"").slice(0,5),branchId:effectiveBranch});
    }
  }
  items.sort((a,b)=>b.date.localeCompare(a.date)||b.startTime.localeCompare(a.startTime));
  return NextResponse.json({ok:true,from,to,count:items.length,items:items.slice(0,100)});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Eksik yoklama raporu alınamadı."},{status:500});}
}
