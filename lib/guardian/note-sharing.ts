import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createNotification} from '@/lib/notifications/create-notification';
import {revalidateGuardianConnection} from './revalidate';
export async function notifySharedNote(org:string,studentId:string,noteId:string,body:string,authorId:string){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:student,error:studentError}=await db.from('students').select('id').eq('organization_id',org).eq('id',studentId).eq('status','active').eq('is_deleted',false).maybeSingle();
 if(studentError)throw new Error('Kursiyer erişimi doğrulanamadı.');
 if(!student)return {count:0};
 const {data:links,error}=await db.from('guardian_students').select('guardian_id').eq('student_id',studentId).eq('portal_access',true).eq('receives_messages',true);
 if(error)throw new Error('Not alıcıları yüklenemedi.');
 if(!links?.length)return {count:0};
 const {data:guardians,error:guardianError}=await db.from('guardians').select('auth_user_id').eq('organization_id',org).eq('is_active',true).eq('login_enabled',true).in('id',links.map(l=>l.guardian_id));
 if(guardianError)throw new Error('Veli hesapları yüklenemedi.');
 const ids=[...new Set((guardians||[]).map(g=>g.auth_user_id).filter(Boolean))] as string[];
 if(!ids.length)return {count:0};
 for(const id of ids)revalidateGuardianConnection(id,studentId);
 const result=await createNotification({organizationId:org,category:'students',eventKey:'guardian_note_shared',title:'Öğrenciniz için yeni not',body,studentId,sourceType:'student_note',sourceId:noteId,targetPath:`/veli-mesajlar?child=${studentId}#not-${noteId}`,recipientProfileIds:ids,createdBy:authorId,push:true});
 return {count:result.recipientCount};
}

export async function hideSharedNoteNotifications(org:string,studentId:string,noteId:string){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await db.from('system_notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('organization_id',org).eq('student_id',studentId).eq('source_type','student_note').eq('source_id',noteId).eq('event_key','guardian_note_shared');
 if(error)throw new Error('Not bildirimleri güncellenemedi.');
}
