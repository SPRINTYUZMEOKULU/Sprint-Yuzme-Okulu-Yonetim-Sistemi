import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import InvoiceNavigation from "../invoice-navigation";
import EsmmAmountPreview from "./preview";
import "../style.css";
import "./style.css";
export const dynamic = "force-dynamic";
export default async function EsmmPreparationPage() {
  const profile = await requireProfile(["owner", "admin", "accounting"]);
  if (!profile.organization_id) return <main>Kurum bilgisi bulunamadı.</main>;
  const db = documentAdmin();
  const [approvals, ledger, readyRequests, gibAccepted] = await Promise.all([
    db.from("esmm_issue_approvals").select("id",{count:"exact",head:true})
      .eq("organization_id",profile.organization_id),
    db.from("esmm_provider_ledger").select("id",{count:"exact",head:true})
      .eq("organization_id",profile.organization_id),
    db.from("payment_document_requests").select("id",{count:"exact",head:true})
      .eq("organization_id",profile.organization_id).eq("status","payment_received")
      .eq("document_type","e_smm"),
    db.from("esmm_provider_ledger").select("id",{count:"exact",head:true})
      .eq("organization_id",profile.organization_id).eq("state","gib_accepted")
  ]);
  const countsError = !!(approvals.error||ledger.error||readyRequests.error||gibAccepted.error);
  return <main className="invoice-center esmm-preparation">
    <header><InvoiceNavigation home="/fatura-merkezi"/><p className="invoice-kicker">BELGE HAZIRLIĞI · ÖNİZLEME</p><h1>e-SMM Hesap Hazırlığı</h1><p>Tahsilat ile brüt hizmet bedelini ayırarak makbuz örneğinin hesabını kontrol edin.</p></header>
    <section className="invoice-card esmm-readiness" aria-labelledby="esmm-live-status">
      <h2 id="esmm-live-status">Canlı e-SMM işlem hazırlığı</h2>
      <p>Bu sayılar SprintOS veritabanındaki kayıtlardır; İşNet portalında daha önce düzenlenmiş makbuzları kapsamaz.</p>
      {countsError ? <p role="alert" className="invoice-error">Bazı e-SMM kayıtları okunamadı. Eksik sonucu sıfır kabul etmeyiniz.</p> :
        <div className="esmm-readiness-grid">
          <div><span>Ödeme eşleşmiş e-SMM talebi</span><strong>{readyRequests.count??0}</strong></div>
          <div><span>Yönetici ön onayı</span><strong>{approvals.count??0}</strong></div>
          <div><span>Sağlayıcı işlem kaydı</span><strong>{ledger.count??0}</strong></div>
          <div><span>GİB kabulü kayıtlı</span><strong>{gibAccepted.count??0}</strong></div>
        </div>}
      <p><strong>Canlı gönderim kapalı.</strong> İşNet'in test raporu kabulü, firmanın canlı web servis erişimi ve sabit çıkış IP yetkisi doğrulanmadı. Sağlayıcı işlem defteri yalnızca gelecekteki tekil ETTN, durum ve özel arşiv izini tutmak için hazırlandı; henüz herhangi bir makbuz oluşturmaz.</p>
      <Link href="/odeme-bilgileri/belgeler">Belge taleplerini ve ön onayları incele</Link>
    </section>
    <EsmmAmountPreview/>
    <section className="invoice-card esmm-launch" aria-labelledby="esmm-launch-title">
      <h2 id="esmm-launch-title">İlk gerçek e-SMM öncesi kontrol</h2>
      <p>Örnek makbuz tutar hesaplamasıdır; bu listeyi tamamlamak gerçek belgeyi otomatik düzenlemez.</p>
      <ol className="esmm-launch-steps">
        <li><strong>Alıcı ve tahsilat</strong><p><Link href="/odeme-bilgileri/belgeler">Belge ve ödeme takibinde</Link> kursiyer, alıcı kimliği, il/ilçe, açık adres, ödeme tutarı ve banka eşleştirmesini yönetici doğrular. Var olan makbuzlar yeniden gönderilmez.</p></li>
        <li><strong>Hizmet ve vergi profili</strong><p>Mali müşavir hizmet açıklaması, vergilendirme dönemi, KDV, GV stopajı ve tevkifat oranlarını teyit eder. Örnek makbuzdaki %20 KDV / %0 kesintiler her işlem için varsayılmaz.</p></li>
        <li><strong>İşNet test onayı</strong><p>13 Kasım testinde SearchESMM ve PDF/XML doğrulandı; son kayıt <code>ReportStatus=WaitingForSending</code>. Aynı ETTN sorgulanmalı ve <code>GibRaporuKabulEtti</code> sonucu doğrulanmalıdır. Aynı belge tekrar gönderilmez.</p></li>
        <li><strong>Canlı servis yetkisi</strong><p>Sprint'in gerçek düzenleyen hesabı için İşNet canlı web servis erişimi, sabit çıkış IP'si, belge serisi ve yetkilendirilmiş firma bilgileri doğrulanır. Bu bilgiler kamuya açık alanda gösterilmez.</p></li>
        <li><strong>Tek belge pilotu</strong><p>Yönetici onaylı tek tahsilat üzerinde önce mükerrer belge kontrolü yapılır. ETTN, durum, PDF ve XML kursiyer dosyasında doğrulandıktan sonra daha geniş kullanım değerlendirilir.</p></li>
      </ol>
      <p className="esmm-launch-warning"><strong>Gönderim kilitli:</strong> Bu ekranda “Fatura Kes” veya canlı İşNet gönderim butonu bulunmaz. Sonuç ve yetkiler doğrulanmadan otomatik kesim açılmaz.</p>
    </section>
  </main>;
}
