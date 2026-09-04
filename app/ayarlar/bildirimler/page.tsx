import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import NotificationSettingsClient from "./notification-settings-client";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  await requireProfile(["owner", "admin"]);

  return (
    <main className="notificationPage">
      <div className="notificationContainer">
        <header className="notificationHeader">
          <div>
            <p>SPRINTOS · AYARLAR</p>
            <h1>Mesaj ve Bildirimler</h1>
            <span>
              Telefon push bildirimlerini cihaz bazında yönetin. Bildirimler açık olduğunda ekranda sabit bir uyarı kutusu gösterilmez.
            </span>
          </div>
          <div className="notificationHeaderActions">
            <Link href="/ayarlar">← Ayarlar Merkezi</Link>
            <Link href="/">Ana Sayfa</Link>
          </div>
        </header>

        <NotificationSettingsClient />

        <section className="notificationInfoGrid">
          <article>
            <b>✓ Varsayılan davranış</b>
            <p>Bu cihazda izin verilmişse SprintOS bildirim aboneliğini açık tutar ve sayfalarda bildirim durum kutusu göstermez.</p>
          </article>
          <article>
            <b>🔕 İsteğe bağlı kapatma</b>
            <p>Bu cihaz için bildirimleri kapatmak veya tekrar açmak istediğinizde yalnızca bu ayar ekranını kullanabilirsiniz.</p>
          </article>
          <article>
            <b>📱 Cihaz bazlı</b>
            <p>iPhone, iPad, Android veya bilgisayardaki bildirim tercihi yalnızca işlem yaptığınız cihaz için geçerlidir.</p>
          </article>
        </section>
      </div>

      <style>{`
        *{box-sizing:border-box}.notificationPage{min-height:100vh;padding:34px;background:#f4f7fb;color:#14213d;font-family:Arial,sans-serif}.notificationContainer{max-width:1050px;margin:0 auto}.notificationHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:22px;margin-bottom:22px}.notificationHeader p{margin:0 0 6px;color:#176de9;font-size:10px;font-weight:900;letter-spacing:1.4px}.notificationHeader h1{margin:0;font-size:34px;letter-spacing:-1px}.notificationHeader span{display:block;max-width:680px;margin-top:8px;color:#718096;font-size:13px;line-height:1.55}.notificationHeaderActions{display:flex;gap:8px;flex-wrap:wrap}.notificationHeaderActions a{display:inline-flex;align-items:center;justify-content:center;min-height:41px;padding:0 14px;border:1px solid #d8e1ed;border-radius:11px;background:#fff;color:#344054;text-decoration:none;font-size:11px;font-weight:900}.notificationInfoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:15px}.notificationInfoGrid article{padding:16px;border:1px solid #e0e7f0;border-radius:15px;background:#fff}.notificationInfoGrid b{font-size:12px}.notificationInfoGrid p{margin:7px 0 0;color:#718096;font-size:11px;line-height:1.55}@media(max-width:760px){.notificationPage{padding:20px 14px}.notificationHeader{display:grid}.notificationHeader h1{font-size:28px}.notificationInfoGrid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
