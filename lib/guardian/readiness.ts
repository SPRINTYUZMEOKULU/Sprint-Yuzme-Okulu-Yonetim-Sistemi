export type PortalReadinessRow={id:string;name:string;hasPortal:boolean;missingPackage:boolean;missingPeriod:boolean;awaitingStart:boolean};
export function buildPortalReadiness(students:any[],enrollments:any[],links:any[],guardians:any[],profiles:any[],plans:any[]){
 const activeProfiles=new Set(profiles.filter(p=>p.is_active&&p.role==='guardian').map(p=>p.id));
 const accessibleGuardians=new Set(guardians.filter(g=>g.is_active&&g.login_enabled&&activeProfiles.has(g.auth_user_id)).map(g=>g.id));
 const linkedStudents=new Set(links.filter(l=>l.portal_access&&accessibleGuardians.has(l.guardian_id)).map(l=>l.student_id));
 const pricedPeriods=new Set(plans.filter(p=>p.status!=='cancelled'&&Number.isFinite(Number(p.total_amount))).map(p=>p.enrollment_id));
 const rows:PortalReadinessRow[]=students.map(student=>{
  const periods=enrollments.filter(e=>e.student_id===student.id&&['active','scheduled'].includes(e.status)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const period=periods.find(e=>e.status==='active')||periods[0];
  return {id:student.id,name:[student.first_name,student.last_name].filter(Boolean).join(' '),hasPortal:linkedStudents.has(student.id),missingPeriod:!period,missingPackage:Boolean(period&&!period.package_id&&!pricedPeriods.has(period.id)),awaitingStart:Boolean(period&&(period.status==='scheduled'||period.start_confirmation_required&&!period.actual_started_at))};
 });
 return {rows,activeStudents:rows.length,connected:rows.filter(r=>r.hasPortal).length,missingPackage:rows.filter(r=>r.missingPackage).length,missingPeriod:rows.filter(r=>r.missingPeriod).length,awaitingStart:rows.filter(r=>r.awaitingStart).length};
}
export async function loadPortalReadiness(db:any,organizationId:string){
 async function all(table:string,columns:string,configure?:(q:any)=>any){
  const rows:any[]=[];
  for(let offset=0;;offset+=500){let q=db.from(table).select(columns);if(table!=='guardian_students')q=q.eq('organization_id',organizationId);if(configure)q=configure(q);const ordered=table==='guardian_students'?q.order('student_id').order('guardian_id'):q.order('id');const result=await ordered.range(offset,offset+499);if(result.error)throw Error('Veli kullanım kontrolleri tamamlanamadı.');rows.push(...result.data||[]);if((result.data||[]).length<500)return rows;}
 }
 const [students,enrollments,guardians,profiles,plans]=await Promise.all([
  all('students','id,first_name,last_name',q=>q.eq('status','active').eq('is_deleted',false)),
  all('student_enrollments','id,student_id,package_id,status,start_confirmation_required,actual_started_at,created_at',q=>q.in('status',['active','scheduled'])),
  all('guardians','id,auth_user_id,is_active,login_enabled'),
  all('profiles','id,role,is_active',q=>q.eq('role','guardian')),
  all('student_payment_plans','id,enrollment_id,total_amount,status'),
 ]);
 const links:any[]=[];
 for(let offset=0;offset<students.length;offset+=100)links.push(...await all('guardian_students','student_id,guardian_id,portal_access',q=>q.in('student_id',students.slice(offset,offset+100).map(s=>s.id)).eq('portal_access',true)));
 return buildPortalReadiness(students,enrollments,links,guardians,profiles,plans);
}
