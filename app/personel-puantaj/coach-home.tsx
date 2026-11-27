import Link from "next/link";
import NotificationSettingsClient from "@/app/ayarlar/bildirimler/notification-settings-client";
import UstGezinme from "@/app/components/UstGezinme";
import type { CurrentProfile } from "@/lib/auth/profile";
import PersonelPuantajClient from "./personel-puantaj-client";
import "./personel-puantaj.css";

export default function CoachHome({ profile, preview, initialDate }: {
  profile: CurrentProfile;
  initialDate?: string;
  preview?: { id: string; name: string; profileId: string | null };
}) {
  const firstName = (preview?.name || profile.full_name)?.trim().split(/\s+/)[0];
  return (
    <>
      <UstGezinme />
      <main className="ppPage ppCoachHome">
        <div className="ppShell">
          <header className="ppHeader">
            <div>
              <p className="ppEyebrow">{preview ? "Personel görünümü" : "Eğitmen paneli"}</p>
              <h1>{preview?.name || (firstName || "Ders programı")}</h1>
            </div>
            {preview ? <Link className="ppBack" href="/personel-puantaj">← Personel listesi</Link> : profile.is_super_user ? <Link href="/?yonetim=1" className="ppBack">Yönetim Ekranı</Link> : null}
          </header>
          {preview ? (
            <details className="ppCoachNotifications ppPreviewSettings">
              <summary>Personel ayarları</summary>
              <nav className="ppPreviewTools" aria-label="Personel düzenleme">
                {preview.profileId ? <Link className="ppBack" href={`/kullanicilar-ve-yetkiler?profile=${preview.profileId}`}>Personel bilgileri</Link> : null}
                <Link className="ppBack" href={`/personel-puantaj/ucret-ayarlari#personel-${preview.id}`}>Ücret bilgileri</Link>
              </nav>
            </details>
          ) : null}
          <PersonelPuantajClient key={preview?.id} currentRole="coach" coachHome previewStaffId={preview?.id} initialDate={initialDate} />
          {!preview ? <details className="ppCoachNotifications">
            <summary>Telefon bildirimlerini aç veya test et</summary>
            <NotificationSettingsClient />
          </details> : null}
        </div>
      </main>
    </>
  );
}
