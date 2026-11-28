import Image from "next/image";
import { publicRegistrationSettings } from "@/lib/settings/public";

import PreRegistrationForm from "./pre-registration-form";
import PreRegEnhancements from "./pre-reg-enhancements";

import "./on-kayit.css";

export const dynamic = "force-dynamic";
export default async function PreRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ sube?: string | string[]; kurs?: string | string[] }>;
}) {
  const { sube, kurs } = await searchParams;
  const isMuratpasa = sube === "muratpasa";
  const preferredCourseType = kurs === "cocuk"
    ? "Çocuk Yüzme Kursu"
    : kurs === "yetiskin" ? "Yetişkin Yüzme Kursu" : undefined;
  const { brand, registration } = await publicRegistrationSettings();

  return (
    <main className="preRegPage preRegPageCompact">
      <PreRegEnhancements />
      <section className="preRegShell">
        <div className="preRegContent">
          <header className="preRegTop preRegTopCompact">
            <Image
              className="preRegLogo"
              unoptimized
              src={String(brand.logo_url || "/sprint-logo.png?v=6")}
              alt={String(brand.display_name)}
              width={64}
              height={64}
              priority
            />
            <div>
              <h1>{isMuratpasa ? "Muratpaşa Ön Kayıt" : "Yüzme Kursu Ön Kayıt"}</h1>
              <span>
                {isMuratpasa ? "Süleyman Erol Olimpik Yüzme Havuzu" : String(registration.welcome_text)}
              </span>
            </div>
          </header>

          {registration.public_enabled ? <PreRegistrationForm preferredBranchName={isMuratpasa ? "Süleyman Erol Olimpik" : undefined} preferredCourseType={preferredCourseType} /> : <div role="status" style={{padding:24,borderRadius:16,background:"#eef5ff",lineHeight:1.7}}>{String(registration.closed_text)}</div>}
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
