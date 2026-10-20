"use server";
import {createClient} from '@supabase/supabase-js';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireProfile} from '@/lib/auth/profile';
import {getGuardianContext} from '@/lib/guardian/data';
function admin(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
function value(form:FormData,key:string){return String(form.get(key)||'').trim();}
function back(path:string,child:string,key:'saved'|'error',text:string):never{const params=new URLSearchParams({[key]:text});if(child)params.set('child',child);redirect(`${path}?${params}`);}
export async function acceptPortalDocument(form:FormData){
 const profile=await requireProfile(['guardian']);const child=value(form,'child');const id=value(form,'document_id');
 const context=await getGuardianContext(profile.id,child,"documents");
 if(!context.students.some(student=>student.id===child))back('/veli-belgeler',child,'error','Bu kursiyer için belge onaylama yetkiniz yok.');
 if(form.get('accepted')!=='on')back('/veli-belgeler',child,'error','Onay vermek için belgeyi okuyup onay kutusunu işaretleyin.');
 const document=context.documents.find(doc=>doc.id===id);
 if(!document || !document.requires_consent || Number(value(form,'document_version'))!==Number(document.version))back('/veli-belgeler',child,'error','Belge değişmiş veya yayından kaldırılmış. Güncel metni tekrar kontrol edin.');
 const db=admin();
 const {data:existing,error:readError}=await db.from('guardian_consents').select('id').eq('organization_id',profile.organization_id).eq('guardian_id',profile.id).eq('student_id',child).eq('document_id',id).eq('document_version',document.version).maybeSingle();
 if(readError)back('/veli-belgeler',child,'error','Belge onayı kontrol edilemedi.');
 if(!existing){const {error}=await db.from('guardian_consents').insert({organization_id:profile.organization_id,guardian_id:profile.id,student_id:child,document_id:id,document_version:document.version});if(error && error.code!=='23505')back('/veli-belgeler',child,'error','Belge onayı kaydedilemedi. Lütfen tekrar deneyin.');}
 for(const path of ['/veli-paneli','/veli-belgeler',`/veliler/${profile.id}`,'/veliler/icerik'])revalidatePath(path);
 back('/veli-belgeler',child,'saved','Belge onayınız kaydedildi.');
}
export async function markPortalMessageRead(form:FormData){
 const profile=await requireProfile(['guardian']);const child=value(form,'child');const id=value(form,'message_id');
 const context=await getGuardianContext(profile.id,child,"messages");
 if(!context.students.some(student=>student.id===child)||!context.messages.some(message=>message.id===id&&message.kind!=="note"))back('/veli-mesajlar',child,'error','Bu mesaj için işlem yetkiniz yok.');
 const db=admin();
 const {data,error}=await db.from('guardian_messages').update({read_at:new Date().toISOString()}).eq('organization_id',profile.organization_id).eq('guardian_id',profile.id).eq('id',id).is('read_at',null).select('id');
 if(error)back('/veli-mesajlar',child,'error','Mesaj durumu güncellenemedi.');
 const {error:notificationError}=await db.from('system_notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('organization_id',profile.organization_id).eq('recipient_user_id',profile.id).eq('source_type','guardian_message').eq('source_id',id);
 for(const path of ['/veli-paneli','/veli-mesajlar',`/veliler/${profile.id}`,'/veliler/icerik'])revalidatePath(path);
 back('/veli-mesajlar',child,'saved',notificationError?'Mesaj okundu olarak kaydedildi; bildirim durumu güncellenemedi.':data?.length?'Mesaj okundu olarak işaretlendi.':'Mesaj zaten okundu olarak kayıtlı.');
}
