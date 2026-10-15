import Image from "next/image";
import { publicRegistrationSettings } from "@/lib/settings/public";

import PreRegistrationForm from "./pre-registration-form";
import PreRegEnhancements from "./pre-reg-enhancements";

import "./on-kayit.css";

export const dynamic = "force-dynamic";
export default async function PreRegistrationPage() {
  const { brand, registration } = await publicRegistrationSettings();
  return (
    <main className="preRegPage">
      <PreRegEnhancements />
      <section className="preRegShell">
        <aside className="preRegBrand">
          <div className="preRegBrandTop">
            <Image
              className="preRegLogo"
              unoptimized
              src={String(brand.logo_url || "/sprint-logo.png?v=6")}
              alt={String(brand.display_name)}
              width={116}
              height={116}
              priority
            />

            <div className="preRegMobileBrandText">
              <p className="preRegBrandEyebrow">
                {String(brand.display_name)}
              </p>

              <h1>
                Yüzmeye ilk adımınız{" "}
                <span>burada başlıyor.</span>
              </h1>
            </div>
          </div>

          <div className="preRegBrandDesktopText">
            <p className="preRegBrandEyebrow">
              {String(brand.display_name)}
            </p>

            <h1>
              Yüzmeye ilk adımınız{" "}
              <span>burada başlıyor.</span>
            </h1>
          </div>

          <p className="preRegBrandDescription">
            Size uygun şube, grup ve kurs seçeneğini belirleyin.
            Başvurunuz doğrudan kayıt ekibimize ulaşsın.
          </p>

          <div className="preRegBenefits">
            <div className="preRegBenefit">
              <i>✓</i>

              <div>
                <strong>Butik gruplar</strong>
                <small>Kontrollü ve verimli eğitim</small>
              </div>
            </div>

            <div className="preRegBenefit">
              <i>⌁</i>

              <div>
                <strong>Uzman antrenörler</strong>
                <small>Seviyeye uygun planlama</small>
              </div>
            </div>

            <div className="preRegBenefit">
              <i>⚡</i>

              <div>
                <strong>Hızlı dönüş</strong>
                <small>
                  Başvurunuz doğrudan ekibimize düşer
                </small>
              </div>
            </div>
          </div>
        </aside>

        <div className="preRegContent">
          <header className="preRegTop">
            <div>
              <p>ONLINE BAŞVURU</p>

              <h2>Ön Kayıt Formu</h2>

              <span>
                {String(registration.welcome_text)}
              </span>
            </div>
          </header>

          {registration.public_enabled ? <PreRegistrationForm /> : <div role="status" style={{padding:24,borderRadius:16,background:"#eef5ff",lineHeight:1.7}}>{String(registration.closed_text)}</div>}
          <footer style={{marginTop:24,fontSize:12,lineHeight:1.8,color:"#5e7189"}}>
            <strong>{String(brand.legal_name || brand.display_name)}</strong>
            {brand.phone ? <div>{String(brand.phone)}</div> : null}
            {brand.email ? <div>{String(brand.email)}</div> : null}
            {brand.website ? <div><a href={String(brand.website)} rel="noreferrer">{String(brand.website)}</a></div> : null}
            {brand.address ? <div>{String(brand.address)}</div> : null}
          </footer>
        </div>
      </section>
    </main>
  );
}
