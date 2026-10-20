import {NextRequest,NextResponse} from 'next/server';
import {requireProfile} from '@/lib/auth/profile';
import {createClient} from '@/lib/supabase/server';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {guardianStudentAccess} from '@/lib/guardian/access';
import {visibleGuardianNotification} from '@/lib/guardian/notification-visibility';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function access(profile:any){
 const db=createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 return guardianStudentAccess(db,profile.id,profile.organization_id);
}
export async function GET(){
 const p=await requireProfile(['guardian']);const db=await createClient(),scope=await access(p);
 if(scope.error)return NextResponse.json({error:'Bildirim erişimi doğrulanamadı.'},{status:500,headers});
 if(!scope.studentIds.length)return NextResponse.json({profileId:p.id,notifications:[]},{headers});
 const {data,error}=await db.from('system_notifications').select('id,title,body,target_path,created_at,student_id').eq('organization_id',p.organization_id).eq('recipient_user_id',p.id).eq('is_read',false).like('target_path','/veli-%').order('created_at',{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:'Bildirimler yüklenemedi.'},{status:500,headers});
 return NextResponse.json({profileId:p.id,notifications:(data||[]).filter(row=>visibleGuardianNotification(row,scope.studentIds)).slice(0,30)},{headers});
}
export async function POST(request:NextRequest){
 const p=await requireProfile(['guardian']),db=await createClient();const payload=await request.json().catch(()=>({}));
 if(typeof payload.id!=='string'||!payload.id.trim())return NextResponse.json({error:'Bildirim eksik.'},{status:400,headers});
 const scope=await access(p);
 if(scope.error)return NextResponse.json({error:'Bildirim erişimi doğrulanamadı.'},{status:500,headers});
 const {data:notice,error:readError}=await db.from('system_notifications').select('id,student_id,target_path').eq('organization_id',p.organization_id).eq('recipient_user_id',p.id).eq('id',payload.id).maybeSingle();
 if(readError)return NextResponse.json({error:'Bildirim yüklenemedi.'},{status:500,headers});
 if(!scope.studentIds.length||!notice||!visibleGuardianNotification(notice,scope.studentIds))return NextResponse.json({error:'Bildirim bulunamadı.'},{status:404,headers});
 const {data,error}=await db.from('system_notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('organization_id',p.organization_id).eq('recipient_user_id',p.id).eq('id',payload.id).select('id').maybeSingle();
 return error?NextResponse.json({error:'Bildirim güncellenemedi.'},{status:500,headers}):!data?NextResponse.json({error:'Bildirim bulunamadı.'},{status:404,headers}):NextResponse.json({ok:true},{headers});
}
