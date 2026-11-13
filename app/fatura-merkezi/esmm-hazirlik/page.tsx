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
    <section className="invoice-notice"><h2>Gönderim durumu</h2><p>Bu ekran belge düzenlemez, ödeme veya müşteri kaydını değiştirmez. Canlı kesim için hizmet/vergi profili ve sağlayıcının belge durum–PDF/XML doğrulaması tamamlanmalıdır.</p></section>
  </main>;
}
