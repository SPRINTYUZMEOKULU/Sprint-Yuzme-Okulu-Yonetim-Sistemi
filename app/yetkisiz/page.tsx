import Image from "next/image";
import Link from "next/link";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; from?: string }>;
}) {
  const { reason } = await searchParams;
  const pending = reason === "pending";

  return (
    <main className="loginPage single">
      <section className="loginCard statusCard">
        <Link
          href="/"
          className="sprintLogoButton"
          title="Ana Sayfaya Dön"
          aria-label="Ana Sayfaya Dön"
        >
          <Image
            src="/icons/icon-192.png"
            alt="Sprint Yüzme Okulu"
            width={74}
            height={74}
            priority
          />
        </Link>

        <p className="eyebrow">SPRİNTOS GÜVENLİK</p>

        <h1>
          {pending
            ? "Hesabınız onay bekliyor"
            : "Bu alana erişiminiz yok"}
        </h1>

        <p>
          {pending
            ? "Yönetici rolünüzü ve kurum bağlantınızı tanımladıktan sonra giriş yapabilirsiniz."
            : "Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz. Ana sayfaya dönerek yetkiniz bulunan modüllerden devam edebilirsiniz."}
        </p>

        {!pending && (
          <Link className="primaryButton" href="/">
            Ana Sayfaya Dön
          </Link>
        )}

        <Link className="secondaryButton" href="/auth/signout">
          Güvenli Çıkış Yap
        </Link>
      </section>

      <style>{`
        .sprintLogoButton {
          width: 92px;
          height: 92px;
          margin: 0 auto 18px;
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid #dce5f2;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.10);
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        .sprintLogoButton:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14);
        }

        .sprintLogoButton img {
          object-fit: contain;
        }

        .statusCard {
          text-align: center;
        }

        .primaryButton,
        .secondaryButton {
          width: 100%;
          min-height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-weight: 800;
          box-sizing: border-box;
        }

        .primaryButton {
          margin-top: 22px;
        }

        .secondaryButton {
          margin-top: 10px;
          background: #ffffff;
          color: #64748b;
          border: 1px solid #dce5f2;
        }

        .secondaryButton:hover {
          background: #f8fafc;
          color: #334155;
        }
      `}</style>
    </main>
  );
}
