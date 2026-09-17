import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import UstGezinme from "@/app/components/UstGezinme";
import TesisSezonYonetimi from "@/app/operasyon-plani/tesis-sezon-yonetimi";

export const dynamic = "force-dynamic";

export default async function TesisSezonPage(){
  const profile=await requireProfile(["owner","admin","branch_manager"]);
  if(!profile.organization_id) return <main style={{padding:24}}>Organizasyon bilgisi bulunamadı.</main>;
  const supabase=await createClient();
  const [branchesResult,groupsResult,pausesResult]=await Promise.all([
    supabase.from("branches").select("id,name").eq("organization_id",profile.organization_id).eq("is_active",true).order("name"),
    supabase.from("training_groups").select("id,branch_id,name").eq("organization_id",profile.organization_id).eq("is_active",true).order("name"),
    supabase.from("facility_season_pauses").select("id,branch_id,closure_date,estimated_open_date").eq("organization_id",profile.organization_id).eq("status","closed").order("closure_date",{ascending:false}),
  ]);
  const branches=branchesResult.data||[]; const groups=groupsResult.data||[]; const rawPauses=pausesResult.data||[];
  const pauseIds=rawPauses.map((p:any)=>p.id);
  let counts:Record<string,number>={};
  if(pauseIds.length){const {data}=await supabase.from("facility_pause_student_snapshots").select("pause_id").in("pause_id",pauseIds);counts=(data||[]).reduce((a:any,r:any)=>{a[r.pause_id]=(a[r.pause_id]||0)+1;return a;},{});}
  const pauses=rawPauses.map((p:any)=>({...p,affected:counts[p.id]||0}));
  return <><UstGezinme/><main style={{minHeight:"100vh",background:"#f4f7fb",padding:"24px 14px 60px"}}><div style={{maxWidth:1100,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}><div><div style={{fontSize:11,fontWeight:900,letterSpacing:".12em",color:"#1769e8"}}>SPRİNT YÜZME OKULU · OPERASYON</div><h1 style={{margin:"6px 0 3px",fontSize:28,color:"#13233f"}}>Tesis & Sezon Yönetimi</h1><p style={{margin:0,color:"#65758d",fontSize:13}}>Kapanış, ders hakkı dondurma, yeniden başlangıç ve havuz aktarım merkezi.</p></div><Link href="/operasyon-plani" style={{textDecoration:"none",padding:"11px 14px",border:"1px solid #d5e0ee",borderRadius:12,background:"#fff",color:"#1769e8",fontWeight:850,fontSize:13}}>← Operasyon Planı</Link></div><TesisSezonYonetimi branches={branches} groups={groups} pauses={pauses}/></div></main></>;
}
