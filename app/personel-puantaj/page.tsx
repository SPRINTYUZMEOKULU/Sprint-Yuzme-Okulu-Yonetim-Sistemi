import Link from "next/link";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import PersonelPuantajClient from "./personel-puantaj-client";
import PersonelOdemeleri from "./personel-odemeleri";
import "./personel-puantaj.css";

export const dynamic = "force-dynamic";

export default async function PersonelPuantajPage() {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const canManagePay = ["owner", "admin", "branch_manager", "accounting"].includes(profile.role);

  return (
    <>
      <UstGezinme />
      <main className="ppPage">
        <section className="ppShell">
          <header className="ppHeader">
            <div>
              <p className="ppEyebrow">SPRİNTOS · PERSONEL OPERASYONU</p>
              <h1>Personel & Puantaj</h1>
              <p className="ppIntro">
                Yüzme dersleri, antrenör girişleri, seans görevlendirmeleri, aylık puantaj ve hakediş takibi tek ekranda.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {["owner", "admin", "branch_manager"].includes(profile.role) ? <Link href="/operasyon-plani" className="ppBack">Antrenör / Seans Düzenle</Link> : null}
              {canManagePay ? <Link href="/personel-puantaj/ucret-ayarlari" className="ppBack">Ücret Ayarları</Link> : null}
              <Link href="/" className="ppBack">Ana Sayfa</Link>
            </div>
          </header>

          <PersonelPuantajClient currentRole={profile.role} />
          {canManagePay ? <div style={{ marginTop: 16 }}><PersonelOdemeleri /></div> : null}
        </section>
      </main>
    </>
  );
}
