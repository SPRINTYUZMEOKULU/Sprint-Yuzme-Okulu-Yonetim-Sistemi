import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createNotification} from '@/lib/notifications/create-notification';
import {revalidateStudentSurfaces} from '@/lib/students/revalidate';
export async function notifyGuardianFinance(org:string,studentId:string,sourceId:string,title:string,body:string,actor:string,event='guardian_finance_updated'){
 revalidateStudentSurfaces(studentId);
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:student,error:studentError}=await db.from('students').select('id').eq('organization_id',org).eq('id',studentId).eq('status','active').eq('is_deleted',false).maybeSingle();
 if(studentError)throw Error('Kursiyer erişimi doğrulanamadı.');if(!student)return;
 const {data:links,error}=await db.from('guardian_students').select('guardian_id').eq('student_id',studentId).eq('portal_access',true).eq('receives_messages',true);
 if(error)throw Error('Veli bağlantıları okunamadı.');if(!links?.length)return;
 const {data:guardians,error:guardianError}=await db.from('guardians').select('auth_user_id').eq('organization_id',org).eq('is_active',true).eq('login_enabled',true).in('id',links.map(row=>row.guardian_id));
 if(guardianError)throw Error('Portal alıcıları okunamadı.');
 const recipients=[...new Set((guardians||[]).map(row=>row.auth_user_id).filter(Boolean))] as string[];
 if(!recipients.length)return;
 const result=await createNotification({organizationId:org,category:'payment',eventKey:event,title,body,studentId,sourceType:'student_finance',sourceId,targetPath:`/veli-odemeler?child=${studentId}`,recipientProfileIds:recipients,createdBy:actor,push:true,severity:'info'});
 if(!result.ok)throw Error('Veli bildirimi hazırlanamadı.');
}
