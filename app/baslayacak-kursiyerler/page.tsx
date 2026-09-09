import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "../dashboard.css";

export const dynamic = "force-dynamic";

export default async function StartingStudentsPage(){
 const profile=await requireProfile(["owner","admin","branch_manager","registration_staff","coach"]);
 const supabase=await createClient();
 const organizationId=profile.organization_id;
 const {data:students}=await supabase.from("students").select("id,student_number,first_name,last_name,phone,guardian_name,guardian_phone,branch_id,preferred_group_id,created_at").eq("organization_id",organizationId).eq("status","active").eq("is_deleted",false).order("created_at",{ascending:false});
 const ids=(students||[]).map((s:any)=>s.id);
 const [{data:attendance},{data:memberships},{data:branches},{data:groups}]=await Promise.all([
  ids.length?supabase.from("attendance_records").select("student_id").in("student_id",ids):Promise.resolve({data:[]}),
  ids.length?supabase.from("student_group_memberships").select("student_id,group_id,started_at").in("student_id",ids).eq("is_active",true).order("started_at",{ascending:false}):Promise.resolve({data:[]}),
  supabase.from("branches").select("id,name").eq("organization_id",organizationId),
  supabase.from("training_groups").select("id,name,branch_id").eq("organization_id",organizationId),
 ] as any);
 const attended=new Set((attendance||[]).map((r:any)=>String(r.student_id)));
 const membershipMap=new Map<string,any>(); for(const m of memberships||[]){if(!membershipMap.has(String((m as any).student_id)))membershipMap.set(String((m as any).student_id),m)}
 const branchMap=new Map((branches||[]).map((b:any)=>[String(b.id),b.name])); const groupMap=new Map((groups||[]).map((g:any)=>[String(g.id),g]));
 const starting=(students||[]).filter((s:any)=>!attended.has(String(s.id)));
 return <main className="operationPage">
  <header className="operationHeader"><div><p>SPRİNTOS · ÖĞRENCİ YÖNETİMİ</p><h1>Başlayacak Kursiyerler</h1><span>Kesin kaydı tamamlanmış, aktif durumda olan ve henüz ilk yoklaması oluşmamış kursiyerleri takip edin.</span></div><div className="operationActions"><Link href="/ogrenciler">Öğrenci Merkezi</Link><Link href="/yoklama">Yoklama</Link></div></header>
  <section className="operationCard"><div className="sectionHead"><div><p>İLK DERS TAKİBİ</p><h2>{starting.length} kursiyer başlayacak</h2><span>İlk yoklama kaydı oluştuğunda kursiyer bu listeden otomatik çıkar.</span></div></div>
   <div className="studentCardGrid">{starting.length?starting.map((s:any)=>{const membership=membershipMap.get(String(s.id)); const group=groupMap.get(String(membership?.group_id||s.preferred_group_id||"")); const branch=branchMap.get(String(group?.branch_id||s.branch_id||"")); return <article className="studentCard" key={s.id}><div><small>{s.student_number||"Kursiyer"}</small><h3>{s.first_name} {s.last_name}</h3><p>{branch||"Şube belirtilmemiş"} · {group?.name||"Grup belirtilmemiş"}</p><p>Veli: {s.guardian_name||"—"} · Tel: {s.guardian_phone||s.phone||"—"}</p></div><div className="studentCardActions"><Link className="primaryAction" href={`/ogrenciler/${s.id}`}>Öğrenci Dosyası</Link><Link href="/yoklama">Yoklamaya Git</Link></div></article>}):<div className="tableEmpty">Şu anda ilk dersini bekleyen kursiyer bulunmuyor.</div>}</div>
  </section>
  <style>{`.studentCardGrid{display:grid;gap:14px}.studentCard{display:flex;justify-content:space-between;gap:18px;padding:20px;border:1px solid #dce6f2;border-radius:18px;background:#fff}.studentCard small{font-weight:900;color:#1474e8}.studentCard h3{margin:5px 0 7px;font-size:21px;color:#10284d}.studentCard p{margin:4px 0;color:#6f819a}.studentCardActions{display:flex;align-items:center;gap:9px}.studentCardActions a{padding:11px 14px;border:1px solid #d6e2f0;border-radius:12px;color:#15375f;text-decoration:none;font-weight:850;white-space:nowrap}.studentCardActions .primaryAction{background:#1674ed;color:#fff;border-color:#1674ed}@media(max-width:700px){.studentCard{display:block}.studentCardActions{margin-top:15px}.studentCardActions a{flex:1;text-align:center}}`}</style>
 </main>;
}