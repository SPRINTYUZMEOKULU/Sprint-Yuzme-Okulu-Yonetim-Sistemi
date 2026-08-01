import Link from "next/link";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import CopyLinkButton from "./copy-link-button";
import "../dashboard.css";

export const dynamic="force-dynamic";

type PreStudent={id:string;first_name:string;last_name:string;birth_date:string|null;preferred_days:string|null;preferred_time:string|null;swimming_level:string|null;registration_source:string|null;registration_note:string|null;created_at:string;branch_id:string|null};

export default async function PreRegistrationsPage(){
  const profile=await requireProfile(["owner","admin","branch_manager","registration_staff"]);
  const supabase=await createClient();
  const {data:students}=await supabase.from("students").select("id,first_name,last_name,birth_date,preferred_days,preferred_time,swimming_level,registration_source,registration_note,created_at,branch_id").eq("organization_id",profile.organization_id).eq("status","pre_registration").order("created_at",{ascending:false}).limit(100);
  const {data:branches}=await supabase.from("branches").select("id,name").eq("organization_id",profile.organization_id);
  const branchMap=new Map((branches||[]).map(b=>[b.id,b.name]));
  const list=(students||[]) as PreStudent[];
  const today=new Date().toISOString().slice(0,10);
  const todayCount=list.filter(x=>x.created_at?.slice(0,10)===today).length;
  const host=(await headers()).get("host")||""; const protocol=host.includes("localhost")?"http":"https"; const formUrl=`${protocol}://${host}/on-kayit`;
  return <main className="operationPage">
    <header className="operationHeader"><div><p>SPRİNTOS · KAYIT OPERASYONU</p><h1>Ön Kayıt Merkezi</h1><span>Web sitesi ve manuel kanallardan gelen tüm başvuruları tek ekrandan yönetin.</span></div><div className="operationActions"><Link href="/">Dashboard</Link><Link href="/on-kayit" target="_blank">Formu Aç</Link><CopyLinkButton url={formUrl}/></div></header>
    <section className="operationStats"><article><span>Bekleyen Başvuru</span><strong>{list.length}</strong></article><article><span>Bugün Gelen</span><strong>{todayCount}</strong></article><article><span>Aktif Ön Kayıt Linki</span><strong style={{fontSize:16}}>Yayında</strong></article><article><span>Form Durumu</span><strong style={{fontSize:16,color:"#16875b"}}>Aktif</strong></article></section>
    <section className="operationCard"><div className="operationCardHeader"><div><p>BAŞVURU LİSTESİ</p><h2>Bekleyen Ön Kayıtlar</h2></div><input aria-label="Ön kayıt ara" placeholder="Öğrenci, şube veya telefon ara..." /></div>
      <div className="responsiveTable"><table><thead><tr><th>Öğrenci</th><th>Şube</th><th>Tercih</th><th>Seviye</th><th>Kaynak</th><th>Başvuru</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>
        {list.map(item=><tr key={item.id}><td><strong>{item.first_name} {item.last_name}</strong><br/><small>{item.registration_note||"Not bulunmuyor"}</small></td><td>{item.branch_id?branchMap.get(item.branch_id)||"—":"—"}</td><td>{item.preferred_days||"Gün seçilmedi"}<br/><small>{item.preferred_time||"Saat seçilmedi"}</small></td><td>{item.swimming_level||"Belirtilmedi"}</td><td>{item.registration_source==="web_form"?"Web Formu":item.registration_source||"Manuel"}</td><td>{new Intl.DateTimeFormat("tr-TR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.created_at))}</td><td><span className="statusPill pre_registration">Bekliyor</span></td><td><button type="button">Başvuruyu Aç</button></td></tr>)}
        {!list.length&&<tr><td colSpan={8} className="tableEmpty"><strong>Henüz bekleyen ön kayıt bulunmuyor.</strong><br/>Web sitenize koyacağınız form linkinden gelen başvurular burada görünecek.</td></tr>}
      </tbody></table></div>
    </section>
  </main>;
}
