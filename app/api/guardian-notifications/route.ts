import {NextRequest,NextResponse} from 'next/server';
import {requireProfile} from '@/lib/auth/profile';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(){
 const p=await requireProfile(['guardian']);const db=await createClient();
 const {data,error}=await db.from('system_notifications').select('id,title,body,target_path,created_at').eq('organization_id',p.organization_id).eq('recipient_user_id',p.id).eq('is_read',false).order('created_at',{ascending:false}).limit(30);
 if(error)return NextResponse.json({error:'Bildirimler yüklenemedi.'},{status:500});
 return NextResponse.json({profileId:p.id,notifications:data||[]},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:NextRequest){
 const p=await requireProfile(['guardian']),db=await createClient();const payload=await request.json().catch(()=>({}));
 if(typeof payload.id!=='string')return NextResponse.json({error:'Bildirim eksik.'},{status:400});
 const {error}=await db.from('system_notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('organization_id',p.organization_id).eq('recipient_user_id',p.id).eq('id',payload.id);
 return error?NextResponse.json({error:'Bildirim güncellenemedi.'},{status:500}):NextResponse.json({ok:true});
}
