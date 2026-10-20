import type {SupabaseClient} from '@supabase/supabase-js';
/** Server-only caller supplies the authenticated profile and its organization. */
export async function guardianStudentAccess(db:SupabaseClient,profileId:string,organizationId:string){
 const {data:guardian,error}=await db.from('guardians').select('id').eq('organization_id',organizationId).eq('auth_user_id',profileId).eq('is_active',true).eq('login_enabled',true).maybeSingle();
 if(error)return {studentIds:[] as string[],error};
 if(!guardian)return {studentIds:[] as string[],error:null};
 const links=await db.from('guardian_students').select('student_id').eq('guardian_id',guardian.id).eq('portal_access',true);
 if(links.error||!links.data?.length)return {studentIds:[] as string[],error:links.error};
 const students=await db.from('students').select('id').eq('organization_id',organizationId).in('id',links.data.map(l=>l.student_id)).eq('status','active').eq('is_deleted',false);
 return {studentIds:(students.data||[]).map(s=>s.id) as string[],error:students.error};
}
