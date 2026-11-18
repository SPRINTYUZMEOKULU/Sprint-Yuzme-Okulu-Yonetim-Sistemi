import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import InvoiceNavigation from "../invoice-navigation";
import EsmmAmountPreview from "./preview";
import "../style.css";
import "./style.css";
export const dynamic = "force-dynamic";
export default async function EsmmPreparationPage() {
  const profile = await requireProfile(["owner", "admin", "accounting"]);
  if (!profile.organization_id) return <main>Kurum bilgisi bulunamadı.</main>;
  return <main className="invoice-center esmm-preparation">
    <header><InvoiceNavigation home="/fatura-merkezi"/><p className="invoice-kicker">BELGE HAZIRLIĞI · ÖNİZLEME</p><h1>e-SMM Hesap Hazırlığı</h1><p>Tahsilat ile brüt hizmet bedelini ayırarak makbuz örneğinin hesabını kontrol edin.</p></header>
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
