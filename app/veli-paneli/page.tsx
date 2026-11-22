import GuardianOverviewCards from "./guardian-overview-cards";
import { randomUUID } from "node:crypto";
import SatisfactionSurvey from "./support-survey";
import PortalLoading from "./portal-loading";
import SprintSupport from "./sprint-support";
import UiIcon from "@/app/components/ui-icon";
import { Suspense } from "react";
import {guardianPageIdentity, loadGuardianPage, type GuardianPageQuery} from "@/lib/guardian/page-context";
import { safePortalUrl, currentDocumentConsent } from "@/lib/guardian/presentation";
import Link from "next/link";
import { EmptyGuardian, GuardianHeader, GuardianIcon } from "./guardian-ui";
import "./veli.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianPortal({ searchParams }: { searchParams: Promise<{ child?: string; previewGuardian?:string }> }) {
  const query = await searchParams;
  const identity = await guardianPageIdentity(query);
  return <Suspense fallback={<PortalLoading />}>
    <GuardianOverview query={query} identity={identity} />
  </Suspense>;
}

async function GuardianOverview({query,identity}:{query:GuardianPageQuery;identity:Awaited<ReturnType<typeof guardianPageIdentity>>}) {
  const {profile,data,previewGuardian}=await loadGuardianPage(query,"overview",identity);

  if (!data.selected) {
    return <main className="guardianShell"><GuardianHeader previewGuardian={previewGuardian} name={profile.full_name || "Değerli Velimiz"} students={data.students} issues={data.issues} /><div className="guardianContent"><EmptyGuardian title="Bağlı öğrenci bulunamadı" text="Öğrenci bağlantınız yönetim tarafından tamamlandığında ders, ödeme, yoklama ve gelişim bilgileriniz otomatik olarak burada görüntülenecektir." /><SprintSupport /></div></main>;
  }

  const selectedId = data.selected.id;
  const unreadMessages=data.unreadMessageCount??data.messages.filter((m:any)=>m.kind!=="note"&&!m.read_at).length;
  const pendingDocuments=data.documents.filter((document:any)=>document.requires_consent&&!currentDocumentConsent(document,data.consents)).length;
  const openRequests=data.openRequestCount??(data.requests||[]).filter((request:any)=>!["resolved","rejected","archived"].includes(request.status)).length;
  const previewQuery=previewGuardian?`&previewGuardian=${encodeURIComponent(previewGuardian)}`:"";

  return <main className="guardianShell">
    <GuardianHeader previewGuardian={previewGuardian} name={profile.full_name || "Değerli Velimiz"} issues={data.issues} students={data.students} selectedId={selectedId} />
    <div className="guardianContent guardianOverview">
      <GuardianOverviewCards data={data} accountId={profile.id} previewGuardian={previewGuardian} />

      <section className="guardianFollowUps" aria-label="Takip ve bekleyen işlemler">
        <Link className={unreadMessages>0?"guardianAttention":""} href={`/veli-mesajlar?child=${selectedId}${previewQuery}`}><span className="guardianFollowIcon"><GuardianIcon name="message"/></span><span><strong>{data.issues.some(issue=>issue.startsWith("Mesaj"))?"Bilgi alınamadı":`${unreadMessages} okunmamış mesaj`}</strong><small>Mesajlarınızı görüntüleyin</small></span><UiIcon name="chevronRight" size={18}/></Link>
        <Link href={`/veli-talepleri?child=${selectedId}${previewQuery}`}><span className="guardianFollowIcon"><GuardianIcon name="request"/></span><span><strong>{data.issues.some(issue=>issue.startsWith("Talep"))?"Bilgi alınamadı":`${openRequests} açık görüşme`}</strong><small>Talepler ve yönetim yanıtları</small></span><UiIcon name="chevronRight" size={18}/></Link>
        <Link href={`/veli-belgeler?child=${selectedId}${previewQuery}`}><span className="guardianFollowIcon"><GuardianIcon name="document"/></span><span><strong>{data.issues.some(issue=>issue.startsWith("Belge")||issue.startsWith("Onay"))?"Bilgi alınamadı":pendingDocuments?`${pendingDocuments} belge onay bekliyor`:data.documents.some((document:any)=>document.requires_consent)?"Belge onayları güncel":"Kurallar ve bilgilendirme"}</strong><small>Güncel kurallar ve belgeler</small></span><UiIcon name="chevronRight" size={18}/></Link>
      </section>

      <section className="guardianActions">
        <Link className="guardianAction" href={`/veli-gelisim?child=${selectedId}${previewQuery}`}><span><GuardianIcon name="progress"/></span><div><strong>Gelişim Notları</strong><small>Antrenör değerlendirmeleri</small></div></Link>
        {safePortalUrl(data.branch?.location_url) ? <a className="guardianAction" href={safePortalUrl(data.branch.location_url)!} target="_blank" rel="noreferrer"><span><GuardianIcon name="location"/></span><div><strong>Havuz Konumu</strong><small>Haritada görüntüle</small></div></a> : null}
        <Link className="guardianAction" href={`/veli-odemeler?child=${selectedId}${previewQuery}`}><span><GuardianIcon name="wallet"/></span><div><strong>Ödeme Geçmişi</strong><small>Ödeme ve borç durumu</small></div></Link>
        <Link className="guardianAction" href={`/veli-duyurular?child=${selectedId}${previewQuery}`}><span><GuardianIcon name="bell"/></span><div><strong>Duyurular</strong><small>Güncel kurs bilgilendirmeleri</small></div></Link>
      </section>

      {!previewGuardian && <SatisfactionSurvey key={selectedId} id={randomUUID()} studentId={selectedId}/>}
      <SprintSupport />
    </div>
  </main>;
}
