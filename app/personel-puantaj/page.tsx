import Link from "next/link";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import PersonelPuantajClient from "./personel-puantaj-client";
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
                Ders girişleri, konum doğrulama, aylık puantaj ve hakediş takibi tek ekranda.
              </p>
            </div>
            <Link href="/" className="ppBack">Ana Sayfa</Link>
          </header>

          <PersonelPuantajClient currentRole={profile.role} />
        </section>
      </main>
    </>
  );
}
