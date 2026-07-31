import Link from "next/link";
import PreRegistrationForm from "./pre-registration-form";

export default function PreRegistrationPage() {
  return (
    <main className="registrationPage">
      <section className="registrationCard">
        <div className="registrationHeader">
          <div>
            <p className="eyebrow">SPRİNT YÜZME OKULU</p>
            <h1>Online Ön Kayıt</h1>
            <p>Bilgilerinizi bırakın, kayıt ekibimiz sizinle iletişime geçsin.</p>
          </div>
          <Link href="/" className="secondaryLink">Panele dön</Link>
        </div>
        <PreRegistrationForm />
      </section>
    </main>
  );
}
