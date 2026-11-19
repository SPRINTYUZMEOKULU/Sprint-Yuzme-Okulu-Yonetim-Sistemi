import Image from "next/image";
import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="v2LoginPage compactLogin">
      <section className="v2BrandPanel" aria-label="Sprint Yüzme Okulu">
        <div className="v2WaterGlow" aria-hidden="true" />
        <div className="v2BrandContent">
          <div className="v2LogoFrame compactLogoFrame">
            <span className="v2LogoHalo" aria-hidden="true" />
            <Image src="/sprint-logo.png?v=6" alt="Sprint Yüzme Okulu" width={520} height={520} priority className="v2BrandLogo" />
          </div>
          <div className="v2Slogan compactSlogan">
            <span>Sprint Yüzme Okulu</span>
            <strong>Veli ve Kursiyer Portalı</strong>
          </div>
          <p className="brandDescription">Ders programınız, kursiyer gelişimi ve ödemeleriniz.</p>
          <div className="v2SloganLine" aria-hidden="true" />

        </div>
        <div className="v2WaveArt" aria-hidden="true"><span/><span/><span/></div>
      </section>

      <section className="v2FormPanel">
        <div className="v2LoginCard compactLoginCard">
          <Suspense fallback={<div className="v2Loading">Giriş ekranı hazırlanıyor…</div>}>
            <LoginForm/>
          </Suspense>
        </div>
      </section>
    </main>
  );
}
