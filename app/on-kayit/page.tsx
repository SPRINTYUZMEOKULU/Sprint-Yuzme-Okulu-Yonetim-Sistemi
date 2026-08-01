import Image from "next/image";
import Link from "next/link";
import PreRegistrationForm from "./pre-registration-form";
import "./on-kayit.css";

export default function PreRegistrationPage() {
  return (
    <main className="preRegPage">
      <section className="preRegShell">
        <aside className="preRegBrand">
          <Image className="preRegLogo" src="/sprint-logo.png" alt="Sprint Yüzme Okulu" width={116} height={116} priority />
          <p className="preRegBrandEyebrow">SPRİNT YÜZME OKULU</p>
          <h1>Yüzmeye ilk adımınız <span>burada başlıyor.</span></h1>
          <p>Size en uygun şube, grup ve paket seçeneğini belirleyin. Kayıt ekibimiz başvurunuzun ardından sizinle iletişime geçsin.</p>
          <div className="preRegBenefits">
            <div className="preRegBenefit"><i>✓</i><div><strong>Butik gruplar</strong><small>Kontrollü ve verimli eğitim</small></div></div>
            <div className="preRegBenefit"><i>⌁</i><div><strong>Uzman antrenörler</strong><small>Seviyeye uygun planlama</small></div></div>
            <div className="preRegBenefit"><i>⚡</i><div><strong>Hızlı dönüş</strong><small>Başvurunuz doğrudan ekibimize düşer</small></div></div>
          </div>
        </aside>
        <div className="preRegContent">
          <header className="preRegTop">
            <div><p>ONLINE BAŞVURU</p><h2>Ön Kayıt Formu</h2><span>Bilgilerinizi eksiksiz doldurun, sizi doğru gruba yönlendirelim.</span></div>
            <Link href="/" className="preRegBack">Yönetim paneli</Link>
          </header>
          <PreRegistrationForm />
        </div>
      </section>
    </main>
  );
}
