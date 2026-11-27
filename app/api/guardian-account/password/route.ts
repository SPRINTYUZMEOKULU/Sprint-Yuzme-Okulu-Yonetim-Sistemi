import {NextRequest,NextResponse} from 'next/server';
import {createClient as createVerifier} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const reply=(ok:boolean,message:string,status=200)=>NextResponse.json({ok,message},{status,headers:{'Cache-Control':'private, no-store'}});
 if(request.headers.get('origin')!==request.nextUrl.origin||!request.headers.get('content-type')?.includes('application/json'))return reply(false,'İstek doğrulanamadı. Sayfayı yenileyip tekrar deneyin.',403);
 try{
  const db=await createClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)return reply(false,'Oturumunuz sona erdi. Yeniden giriş yapın.',401);
  const {data:profile,error:profileError}=await db.from('profiles').select('id,role,organization_id,is_active').eq('id',user.id).maybeSingle();
  if(profileError||!profile||profile.role!=='guardian'||!profile.is_active||!profile.organization_id)return reply(false,'Bu işlem yalnızca aktif veli / kursiyer hesabınız için kullanılabilir.',403);
  const {data:guardian,error:guardianError}=await db.from('guardians').select('id,is_active,login_enabled').eq('organization_id',profile.organization_id).eq('auth_user_id',user.id).maybeSingle();
  if(guardianError||!guardian||guardian.is_active===false||guardian.login_enabled===false)return reply(false,'Portal erişiminiz doğrulanamadı. Yönetimle iletişime geçin.',403);
  const body=await request.json();
  const current=typeof body.currentPassword==='string'?body.currentPassword:'';
  const password=typeof body.newPassword==='string'?body.newPassword:'';
  const confirm=typeof body.confirmPassword==='string'?body.confirmPassword:'';
  if(!current||current.length>100)return reply(false,'Mevcut şifrenizi girin.',400);
  if(password.length<8||password.length>100||password!==password.trim()||/[\r\n`]/.test(password))return reply(false,'Yeni şifre 8–100 karakter olmalı; başında/sonunda boşluk, satır sonu veya ters tırnak içermemelidir.',400);
  if(password!==confirm)return reply(false,'Yeni şifreler eşleşmiyor.',400);
  if(password===current)return reply(false,'Yeni şifreniz mevcut şifrenizden farklı olmalıdır.',400);
  // This repo pins supabase-js 2.49.1, before updateUser(currentPassword).
  // Verify with an isolated public client: never replace the browser session or use admin password resets.
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return reply(false,'Şifre işlemi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',503);
  const verifier=createVerifier(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  try{
   const identity=user.email?{email:user.email}:user.phone?{phone:user.phone}:null;
   if(!identity)return reply(false,'Giriş hesabınız doğrulanamadı. Yönetimle iletişime geçin.',409);
   const {data:verified,error:verifyError}=await verifier.auth.signInWithPassword({...identity,password:current});
   if(verifyError||verified.user?.id!==user.id||!verified.session)return reply(false,'Mevcut şifreniz doğrulanamadı. Kontrol ederek tekrar deneyin.',400);
   // Update through the freshly verified session for this same account.
   const {data:updated,error:updateError}=await verifier.auth.updateUser({password});
   if(updateError){
    switch(updateError.code){
     case 'weak_password':
      return reply(false,'Yeni şifreniz güvenlik kurallarını karşılamıyor. Harf, rakam ve sembol içeren benzersiz bir şifre deneyin.',422);
     case 'same_password':
      return reply(false,'Yeni şifreniz mevcut şifrenizden farklı olmalıdır.',400);
     case 'reauthentication_needed':
     case 'reauthentication_not_valid':
      return reply(false,'Şifre değişikliği için ek doğrulama gerekiyor. Yeni bir şifre bağlantısı istemek için Sprint yönetimine ulaşın.',409);
    }
    if(updateError.status===429)return reply(false,'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',429);
    console.warn('[guardian-account/password] Update rejected',{code:updateError.code,status:updateError.status});
    return reply(false,'Şifre sunucuda güncellenemedi. Tekrar deneyin veya Sprint yönetimine bildirin.',502);
   }
   if(updated.user?.id!==user.id)return reply(false,'Şifre güncellemesi doğrulanamadı. Sprint yönetimine bildirin.',502);
   revalidatePath('/veli-hesabim');
   return reply(true,'Şifreniz güncellendi. Bundan sonraki girişlerinizde yeni şifrenizi kullanın. Aynı hesaba bağlı tüm kursiyerler için geçerlidir.');
  }finally{try{await verifier.auth.signOut({scope:'local'});}catch{/* Only the isolated verification session is closed. */}}
 }catch{return reply(false,'İşlem sonucu doğrulanamadı. Yeni şifreyle girişinizi kontrol edin; sorun sürerse yönetimden destek alın.',500);}
}
