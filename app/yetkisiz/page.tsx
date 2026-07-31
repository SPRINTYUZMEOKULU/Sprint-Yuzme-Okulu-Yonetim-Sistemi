import Link from "next/link";

export default async function UnauthorizedPage({
  searchParams
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const pending = reason === "pending";

  return (
    <main className="loginPage single">
      <section className="loginCard statusCard">
        <div className="loginBrandMark small">S</div>
        <p className="eyebrow">SPRİNTOS GÜVENLİK</p>
        <h1>{pending ? "Hesabınız onay bekliyor" : "Bu alana erişiminiz yok"}</h1>
        <p>{pending ? "Yönetici rolünüzü ve kurum bağlantınızı tanımladıktan sonra giriş yapabilirsiniz." : "Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz."}</p>
        <Link className="primaryButton" href="/auth/signout">Güvenli çıkış yap</Link>
      </section>
    </main>
  );
}
