import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import "./guardian-management.css";

export const dynamic = "force-dynamic";

function adminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");return createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function norm(v:unknown){return String(v||"").trim().toLocaleLowerCase("tr-TR")}

export default async function GuardianManagementPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const profile=await requireProfile(["owner","admin","branch_manager","registration_staff"]);
  const query=await searchParams; const organizationId=profile.organization_id!; const admin=adminClient();
  const [guardiansRes,linksRes,studentsRes,enrollmentsRes,groupsRes,branchesRes,requestsRes]=await Promise.all([
    admin.from("profiles").select("id,full_name,phone,email,is_active,last_sign_in_at,created_at").eq("organization_id",organizationId).eq("role","guardian").order("full_name"),
    admin.from("guardian_students").select("guardian_id,student_id,relationship,is_primary").limit(5000),
    admin.from("students").select("id,first_name,last_name,status,branch_id,preferred_group_id,guardian_name,guardian_phone").eq("organization_id",organizationId).eq("is_deleted",false).limit(5000),
    admin.from("student_enrollments").select("student_id,group_id,status,created_at").eq("organization_id",organizationId).eq("status","active").order("created_at",{ascending:false}),
    admin.from("training_groups").select("id,name,branch_id").eq("organization_id",organizationId),
    admin.from("branches").select("id,name").eq("organization_id",organizationId),
    admin.from("guardian_requests").select("id,status,priority").eq("organization_id",organizationId).limit(1000),
  ]);
  const guardians=guardiansRes.data||[]; const links=linksRes.data||[]; const students=studentsRes.data||[]; const requests=requestsRes.data||[];
  const studentMap=new Map(students.map((s:any)=>[s.id,s])); const groupMap=new Map((groupsRes.data||[]).map((g:any)=>[g.id,g])); const branchMap=new Map((branchesRes.data||[]).map((b:any)=>[b.id,b]));
  const enrollmentMap=new Map<string,any>(); for(const e of enrollmentsRes.data||[])if(!enrollmentMap.has(e.student_id))enrollmentMap.set(e.student_id,e);
  const q=norm(query.q); const status=query.status||"all";
  const rows=guardians.map((g:any)=>({...g,links:links.filter((l:any)=>l.guardian_id===g.id)})).filter((g:any)=>{
    if(status==="active"&&!g.is_active)return false;if(status==="inactive"&&g.is_active)return false;if(status==="unlinked"&&g.links.length)return false;
    if(!q)return true; const childNames=g.links.map((l:any)=>{const s:any=studentMap.get(l.student_id);return `${s?.first_name||""} ${s?.last_name||""}`}).join(" "); return norm(`${g.full_name} ${g.phone} ${g.email} ${childNames}`).includes(q);
  });
  const linkedIds=new Set(links.map((l:any)=>l.student_id)); const unlinkedStudents=students.filter((s:any)=>!linkedIds.has(s.id)&&s.guardian_phone);
  const schemaError=requestsRes.error?.message||null;
  return <><UstGezinme/><main className="guardianAdminPage"><div className="guardianAdminWrap">
    <header className="guardianHero"><div><small>SPRİNTOS · VELİ İLİŞKİLERİ</small><h1>Veli Yönetim Merkezi</h1><p>Veli hesapları, kardeş bağlantıları, portal erişimi ve talepler tek merkezde.</p></div><div className="guardianHeroActions"><Link href="/veli-talepleri">Talep & Görüş Merkezi</Link><Link className="primary" href="/ogrenciler">Öğrenciden Veli Oluştur</Link></div></header>
    {query.saved?<div className="guardianNotice">{query.saved}</div>:null}{query.error?<div className="guardianNotice error">{query.error}</div>:null}{schemaError?<div className="guardianNotice error">Talep tablosu henüz kurulmadı. 015 numaralı SQL kurulumu uygulanmalıdır.</div>:null}
    <section className="guardianStats"><article className="guardianStat"><span>Toplam Veli</span><strong>{guardians.length}</strong></article><article className="guardianStat"><span>Aktif Portal</span><strong>{guardians.filter((g:any)=>g.is_active).length}</strong></article><article className="guardianStat"><span>Bağlı Öğrenci</span><strong>{linkedIds.size}</strong></article><article className="guardianStat"><span>Bağlantı Bekleyen</span><strong>{unlinkedStudents.length}</strong></article><article className="guardianStat"><span>Açık Talep</span><strong>{requests.filter((r:any)=>!["resolved","rejected","archived"].includes(r.status)).length}</strong></article></section>
    <form className="guardianTools"><input name="q" defaultValue={query.q||""} placeholder="Veli, telefon veya öğrenci ara"/><select name="status" defaultValue={status}><option value="all">Tüm hesaplar</option><option value="active">Aktif portal</option><option value="inactive">Pasif portal</option><option value="unlinked">Öğrencisiz hesap</option></select><select name="link" defaultValue={query.link||"all"}><option value="all">Tüm bağlantılar</option><option value="multiple">Birden fazla öğrenci</option><option value="single">Tek öğrenci</option></select><button className="guardianButton primary">Filtrele</button></form>
    <section className="guardianGrid">{rows.filter((g:any)=>query.link==="multiple"?g.links.length>1:query.link==="single"?g.links.length===1:true).map((g:any)=>
      <article className="guardianCard" key={g.id}><div className="guardianCardHead"><div className="guardianIdentity"><span className="guardianAvatar">{String(g.full_name||"V").slice(0,1).toUpperCase()}</span><div><h2>{g.full_name||"İsimsiz Veli"}</h2><p>{g.phone||"Telefon yok"}{g.email?` · ${g.email}`:""}</p></div></div><span className={`guardianPill ${g.is_active?"":"off"}`}>{g.is_active?"Portal Aktif":"Portal Pasif"}</span></div><div className="guardianChildren">{g.links.map((l:any)=>{const s:any=studentMap.get(l.student_id);const e:any=enrollmentMap.get(l.student_id);const gr:any=groupMap.get(e?.group_id||s?.preferred_group_id);const br:any=branchMap.get(gr?.branch_id||s?.branch_id);return <div className="guardianChild" key={l.student_id}><span><b>{s?`${s.first_name} ${s.last_name}`:"Öğrenci bulunamadı"}</b><small>{br?.name||"Şube yok"} · {gr?.name||"Grup yok"}</small></span><small>{l.relationship||"Veli"}{l.is_primary?" · Birincil":""}</small></div>})}{!g.links.length?<div className="guardianChild"><small>Henüz öğrenci bağlantısı yok.</small></div>:null}</div><div className="guardianCardActions"><Link href={`/veliler/${g.id}`}>Veli Dosyasını Aç</Link>{g.links[0]?<Link href={`/ogrenciler/${g.links[0].student_id}`}>Öğrenci Dosyası</Link>:null}</div></article>)}{!rows.length?<div className="guardianEmpty">Aramanıza uygun veli hesabı bulunamadı.</div>:null}</section>
  </div></main></>;
}
