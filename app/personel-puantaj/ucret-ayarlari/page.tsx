import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import UcretAyarlari from "../ucret-ayarlari";
import "./ucret-ayarlari.css";

export const dynamic = "force-dynamic";

export default async function UcretAyarlariPage() {
  await requireProfile(["owner", "admin", "branch_manager"]);

  return (
    <main className="payPage">
      <section className="payShell">
        <header className="payHeader">
          <div>
            <p>SPRİNTOS · PERSONEL & PUANTAJ</p>
            <h1>Ücret Ayarları</h1>
            <span>Ders başı, saatlik veya aylık ücretleri personel bazında belirleyin. Kaydettiğiniz tutarlar aylık hakediş hesabına otomatik yansır.</span>
          </div>
          <Link href="/personel-puantaj">← Personel & Puantaj</Link>
        </header>
        <UcretAyarlari />
      </section>
    </main>
  );
}
