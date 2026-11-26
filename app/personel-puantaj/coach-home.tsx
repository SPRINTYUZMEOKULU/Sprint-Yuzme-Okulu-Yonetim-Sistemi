import Link from "next/link";
import NotificationSettingsClient from "@/app/ayarlar/bildirimler/notification-settings-client";
import UstGezinme from "@/app/components/UstGezinme";
import type { CurrentProfile } from "@/lib/auth/profile";
import PersonelPuantajClient from "./personel-puantaj-client";
import "./personel-puantaj.css";

export default function CoachHome({ profile }: { profile: CurrentProfile }) {
  const firstName = profile.full_name?.trim().split(/\s+/)[0];
  return (
    <>
      <UstGezinme />
      <main className="ppPage ppCoachHome">
        <div className="ppShell">
          <header className="ppHeader">
            <div>
              <p className="ppEyebrow">EĞİTMEN PANELİ</p>
              <h1>{firstName ? `Hoş geldiniz, ${firstName}` : "Derslerim"}</h1>
            </div>
            {profile.is_super_user ? <Link href="/?yonetim=1" className="ppBack">Yönetim Ekranı</Link> : null}
          </header>
          <PersonelPuantajClient currentRole="coach" coachHome />
          <details className="ppCoachNotifications">
            <summary>Telefon bildirimlerini aç veya test et</summary>
            <NotificationSettingsClient />
          </details>
        </div>
      </main>
    </>
  );
}
