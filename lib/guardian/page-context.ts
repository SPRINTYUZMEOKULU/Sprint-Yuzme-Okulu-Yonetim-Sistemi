import {createClient} from '@supabase/supabase-js';
import {notFound} from 'next/navigation';
import {requireProfile} from '@/lib/auth/profile';
import type {GuardianDataView} from './load-plan';
import {getGuardianContext} from './data';
export type GuardianPageQuery={child?:string;previewGuardian?:string;page?:string};
export async function guardianPageIdentity(query:GuardianPageQuery){
 if(!query.previewGuardian){
   const profile=await requireProfile(['guardian']);
   return {profile:{...profile,role:profile.base_role},previewGuardian:undefined};
 }
 const actor=await requireProfile(['owner','admin','branch_manager','registration_staff']);
 if(!actor.organization_id)notFound();
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:profile,error}=await admin.from('profiles').select('id,full_name,organization_id,role,is_active').eq('id',query.previewGuardian).eq('organization_id',actor.organization_id).eq('role','guardian').maybeSingle();
 if(error||!profile)notFound();
 return {profile,previewGuardian:profile.id as string};
}

export async function loadGuardianPage(query:GuardianPageQuery,view:GuardianDataView="overview",identity?:Awaited<ReturnType<typeof guardianPageIdentity>>){
 const {profile,previewGuardian}=identity ?? await guardianPageIdentity(query);
 const data=await getGuardianContext(profile.id,query.child,view,query.page,profile);
 return {profile,data,previewGuardian};
}
