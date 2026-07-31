import Image from "next/image";
import { Suspense } from "react";
import LoginForm from "./login-form";

const featureItems = [
  { icon: "shield", title: "Güvenli Yönetim" },
  { icon: "users", title: "Grup ve Seviye Takibi" },
  { icon: "award", title: "Akıllı Ders Planı" },
  { icon: "chart", title: "Kasa ve Canlı Raporlar" }
] as const;

function FeatureIcon({ name }: { name: (typeof featureItems)[number]["icon"] }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "shield") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></svg>;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>;
  if (name === "award") return <svg {...common}><circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/></svg>;
  return <svg {...common}><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/></svg>;
}

export default function LoginPage() {
  return (
    <main className="v2LoginPage compactLogin">
      <section className="v2BrandPanel" aria-label="SprintOS Bulut2026 tanıtımı">
        <div className="v2WaterGlow" aria-hidden="true" />
        <div className="v2BrandContent">
          <div className="v2LogoFrame compactLogoFrame">
            <span className="v2LogoHalo" aria-hidden="true" />
            <Image src="/sprint-logo.png" alt="Sprint Yüzme Okulu" width={520} height={520} priority className="v2BrandLogo" />
          </div>
          <p className="cloudLabel">SPRINTOS</p>
          <div className="v2Slogan compactSlogan">
            <span>Bulut2026</span>
            <strong>Yönetim Platformu</strong>
          </div>
          <p className="brandDescription">Öğrenci, grup, eğitmen, ödeme ve günlük operasyonları tek merkezden yönetin.</p>
          <div className="v2SloganLine" aria-hidden="true" />
          <div className="v2FeatureGrid">
            {featureItems.map((item) => <div className="v2Feature" key={item.title}><FeatureIcon name={item.icon}/><span>{item.title}</span></div>)}
          </div>
          <p className="poweredBy">Powered by Sprint Yüzme Okulu</p>
        </div>
        <div className="v2WaveArt" aria-hidden="true"><span/><span/><span/></div>
      </section>

      <section className="v2FormPanel">
        <div className="v2LoginCard compactLoginCard">
          <Suspense fallback={<div className="v2Loading">Giriş ekranı hazırlanıyor…</div>}><LoginForm/></Suspense>
        </div>
      </section>
    </main>
  );
}
