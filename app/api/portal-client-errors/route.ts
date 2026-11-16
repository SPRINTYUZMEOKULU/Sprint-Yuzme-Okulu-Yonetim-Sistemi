import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {portalScreens,portalErrorCategories} from '@/lib/guardian/client-diagnostics';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const reject=(status:number)=>NextResponse.json({ok:false},{status,headers:{'Cache-Control':'private, no-store'}});
 if(request.headers.get('origin')!==request.nextUrl.origin||!request.headers.get('content-type')?.includes('application/json'))return reject(403);
 try{
  const db=await createClient();const {data:{user},error}=await db.auth.getUser();if(error||!user)return reject(401);
  const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle();
  if(profileError||!profile?.is_active||!['guardian','owner','admin','branch_manager','registration_staff'].includes(profile.role))return reject(403);
  const body=await request.json();
  if(!(portalScreens as readonly string[]).includes(body.screen)||!(portalErrorCategories as readonly string[]).includes(body.category)||!['safari','chromium','firefox','other'].includes(body.browser))return reject(400);
  const reactCode=Number.isInteger(body.reactCode)&&body.reactCode>=100&&body.reactCode<=9999?body.reactCode:null;
  console.error('SPRINTOS_PORTAL_CLIENT_ERROR',JSON.stringify({screen:body.screen,category:body.category,reactCode,browser:body.browser}));
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return reject(400);}
}
