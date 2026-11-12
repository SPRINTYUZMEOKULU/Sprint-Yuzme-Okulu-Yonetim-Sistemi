import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizedCron } from "@/lib/notifications/cron-auth";
import { runAttendanceBackground } from "@/lib/notifications/attendance-background";
import { runRegistrationBackground } from "@/lib/notifications/registration-background";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return NextResponse.json({ok:false,error:"Sunucu zamanlayıcısı henüz yapılandırılmadı."},{status:503});
 if(!authorizedCron(request.headers.get('authorization'),secret))return NextResponse.json({ok:false,error:"Yetkisiz istek."},{status:401});
 if(new URL(request.url).searchParams.get("check")==="1")return NextResponse.json({ok:true,configured:true,check:true});
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Sunucu veritabanı ayarları eksik.");
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profiles,error}=await client.from('profiles').select('organization_id').eq('is_active',true).in('role',['owner','admin']);
  if(error)throw error;
  const clock=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const part=(t:string)=>clock.find(p=>p.type===t)?.value||'';
  const date=`${part('year')}-${part('month')}-${part('day')}`,minutes=Number(part('hour'))*60+Number(part('minute'));
  const results=[];
  for(const org of new Set((profiles||[]).map(p=>p.organization_id).filter(Boolean))){const {error:syncError}=await client.rpc('sync_scheduled_used_lessons',{p_organization_id:org});if(syncError)throw new Error('Ders sayaçları güncellenemedi.');results.push(await runAttendanceBackground(client,org,date,minutes));results.push(await runRegistrationBackground(client,org));}
  return NextResponse.json({ok:true,date,organizations:new Set((profiles||[]).map(p=>p.organization_id).filter(Boolean)).size,created:results.reduce((n,r)=>n+r.created,0),resolved:results.reduce((n,r)=>n+r.resolved,0),pushSent:results.reduce((n,r)=>n+r.pushSent,0),pushFailed:results.reduce((n,r)=>n+r.pushFailed,0)});
 }catch(error){console.error('SprintOS background attendance failed:',error instanceof Error?error.message:'unknown');return NextResponse.json({ok:false,error:"Arka plan yoklama kontrolü tamamlanamadı."},{status:500});}
}
