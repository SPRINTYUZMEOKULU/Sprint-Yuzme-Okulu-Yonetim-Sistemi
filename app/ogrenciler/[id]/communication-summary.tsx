import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {requestStatusLabels} from '@/lib/guardian/request-state';
export default async function CommunicationSummary({studentId,organizationId}:{studentId:string;organizationId:string}){
 const db=await createClient();
 const {data:links}=await db.from('guardian_students').select('guardian_id').eq('student_id',studentId).eq('portal_access',true);
 const admin=(await import('@supabase/supabase-js')).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:recipients}=links?.length?await admin.from('guardians').select('full_name').eq('organization_id',organizationId).eq('is_active',true).eq('login_enabled',true).in('id',links.map(l=>l.guardian_id)):{data:[]};
 const {data,error}=await db.from('guardian_requests').select('id,subject,status,request_number,guardian_response').eq('organization_id',organizationId).eq('student_id',studentId).order('updated_at',{ascending:false}).limit(20);
 return <aside className="studentCommunicationSummary"><strong>Veli talepleri ve yanıtları</strong><p><b>Veliye açık notları görebilenler: {recipients?.map(r=>r.full_name).join(", ")||"Aktif portal hesabı yok"}.</b></p><p>Veliye açık notlar Mesajlar ekranında, antrenör notları ayrıca Gelişim ekranında görünür. Kurum içi notları yalnızca yetkili personel görür.</p>{error?<p role="alert">Talepler yüklenemedi.</p>:(data||[]).map(r=><Link key={r.id} href={`/veli-talepleri?request=${r.id}#talep-${r.id}`}><span>{r.request_number} · {r.subject}</span><b>{requestStatusLabels[r.status]||r.status}</b></Link>)}{!error&&!data?.length?<small>Bu kursiyere ait veli talebi bulunmuyor.</small>:null}</aside>;
}
