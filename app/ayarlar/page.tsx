import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

type SettingsCard = {
  title: string;
  description: string;
  href: string;
  icon: string;
  accent: string;
  status?: string;
  statusTone?: "active" | "neutral" | "warning";
};

const settingsCards: SettingsCard[] = [
  {
    title: "Ön Kayıt Formu",
    description:
      "Form alanlarını gösterin veya gizleyin, zorunlu alanları belirleyin ve kursiyerlerin göreceği form yapısını yönetin.",
    href: "/ayarlar/on-kayit-formu",
    icon: "📝",
    accent: "#176de9",
    status: "Aktif",
    statusTone: "active",
  },
  {
    title: "Kurum Bilgileri",
    description:
      "Sprint Yüzme Okulu adı, logo, iletişim bilgileri ve genel kurum bilgilerini yönetin.",
    href: "/ayarlar/kurum",
    icon: "🏢",
    accent: "#0f766e",
    status: "Yakında",
    statusTone: "neutral",
  },
  {
    title: "Şube ve Grup Ayarları",
    description:
      "Şubelerin, grupların ve saatlerin sistemde ve ön kayıt formunda nasıl görüneceğini yönetin.",
    href: "/subeler",
    icon: "🏊",
    accent: "#7c3aed",
    status: "Aktif",
    statusTone: "active",
  },
  {
    title: "Paket Ayarları",
    description:
      "Ders paketlerini, fiyatları ve ön kayıt formunda hangi paketlerin yayınlanacağını yönetin.",
    href: "/paketler",
    icon: "📦",
    accent: "#d97706",
    status: "Aktif",
    statusTone: "active",
  },
  {
    title: "Mesaj ve Bildirimler",
    description:
      "WhatsApp mesajları, hazır şablonlar, kayıt bilgilendirmeleri ve sistem bildirimlerini yönetin.",
    href: "/ayarlar/mesajlar",
    icon: "💬",
    accent: "#0891b2",
    status: "Yakında",
    statusTone: "neutral",
  },
  {
    title: "Kullanıcı ve Yetkiler",
    description:
      "Yönetici, şube yöneticisi, kayıt personeli ve antrenörlerin sistem yetkilerini belirleyin.",
    href: "/ayarlar/yetkiler",
    icon: "👥",
    accent: "#be123c",
    status: "Yakında",
    statusTone: "neutral",
  },
  {
    title: "Kurallar ve Onaylar",
    description:
      "Yüzme okulu kuralları, sağlık beyanı, elektronik kabul metinleri ve sürümlerini yönetin.",
    href: "/ayarlar/kurallar",
    icon: "✅",
    accent: "#15803d",
    status: "Planlandı",
    statusTone: "warning",
  },
  {
    title: "Belge ve PDF",
    description:
      "Ön kayıt kabul belgesi, sağlık beyanı ve öğrenci dosyası PDF çıktılarının ayarlarını yönetin.",
    href: "/ayarlar/belgeler",
    icon: "📄",
    accent: "#475569",
    status: "Planlandı",
    statusTone: "warning",
  },
    {
    title: "Sistem Ayarları",
    description:
      "Öğrenci numarası, varsayılan kayıt tercihleri ve SprintOS genel çalışma ayarlarını yönetin.",
    href: "/ayarlar/sistem",
    icon: "⚙️",
    accent: "#334155",
    status: "Planlandı",
    statusTone: "warning",
  },
  {
    title: "Onay Merkezi",
    description:
      "Ödeme, vade tarihi, kayıt düzenleme, silme, kasa teslimi ve diğer kritik işlemlerde yönetici onay kurallarını yönetin.",
    href: "/ayarlar/onay-merkezi",
    icon: "🔐",
    accent: "#7c3aed",
    status: "Aktif",
    statusTone: "active",
  },
];

export default async function SettingsPage() {
  await requireProfile(["owner", "admin"]);

  return (
    <main className="settingsPage">
      <div className="settingsContainer">
        <header className="settingsHeader">
          <div>
            <p className="settingsEyebrow">
              SPRINTOS · YÖNETİM
            </p>

            <h1>Ayarlar Merkezi</h1>

            <span>
              SprintOS'un kayıt, öğrenci, mesaj, şube ve sistem
              davranışlarını tek merkezden yönetin.
            </span>
          </div>

          <div className="settingsHeaderActions">
            <Link href="/" className="secondaryButton">
              ← Yönetim Paneli
            </Link>

            <Link
              href="/on-kayit"
              target="_blank"
              className="primaryButton"
            >
              Ön Kayıt Formunu Gör ↗
            </Link>
          </div>
        </header>

        <section className="settingsOverview">
          <article>
            <div className="overviewIcon blue">⚙</div>

            <div>
              <span>Ayar Merkezi</span>
              <strong>Aktif</strong>
            </div>
          </article>

          <article>
            <div className="overviewIcon green">✓</div>

            <div>
              <span>Ön Kayıt Formu</span>
              <strong>Yayında</strong>
            </div>
          </article>

          <article>
            <div className="overviewIcon orange">🔒</div>

            <div>
              <span>Elektronik Kabul</span>
              <strong>Aktif</strong>
            </div>
          </article>

          <article>
            <div className="overviewIcon purple">9</div>

            <div>
              <span>Ayar Modülü</span>
              <strong>{settingsCards.length}</strong>
            </div>
          </article>
        </section>

        <section className="settingsPanel">
          <div className="settingsPanelHead">
            <div>
              <p>YÖNETİM MODÜLLERİ</p>
              <h2>Sistem Ayarları</h2>

              <span>
                Düzenlemek istediğiniz alanı seçin.
              </span>
            </div>
          </div>

          <div className="settingsGrid">
            {settingsCards.map((item) => (
              <Link
                href={item.href}
                key={item.title}
                className="settingsCard"
              >
                <div
                  className="settingsCardIcon"
                  style={{
                    background: `${item.accent}12`,
                    color: item.accent,
                  }}
                >
                  {item.icon}
                </div>

                <div className="settingsCardBody">
                  <div className="settingsCardTitleRow">
                    <h3>{item.title}</h3>

                    {item.status ? (
                      <span
                        className={`settingsStatus ${
                          item.statusTone || "neutral"
                        }`}
                      >
                        {item.status}
                      </span>
                    ) : null}
                  </div>

                  <p>{item.description}</p>

                  <div className="settingsCardFooter">
                    <span>Ayarları yönet</span>
                    <b>→</b>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="settingsInfo">
          <div className="settingsInfoIcon">i</div>

          <div>
            <strong>Merkezi ayar yapısı</strong>

            <p>
              Burada yapılan ayarlar ilerleyen aşamalarda
              SprintOS'un ilgili modüllerine otomatik uygulanacak.
              Ön Kayıt Formu ayarları ilk bağlanacak modüldür.
            </p>
          </div>
        </section>
      </div>

      <style>{`
        :root {
          --settings-navy: #071b3d;
          --settings-blue: #176de9;
          --settings-bg: #f4f7fb;
          --settings-ink: #14213d;
          --settings-muted: #718096;
          --settings-line: #e0e7f0;
        }

        * {
          box-sizing: border-box;
        }

        .settingsPage {
          min-height: 100vh;
          padding: 34px;
          background:
            radial-gradient(
              circle at 5% 0%,
              rgba(23,109,233,.08),
              transparent 26%
            ),
            var(--settings-bg);
          color: var(--settings-ink);
          font-family: Arial, sans-serif;
        }

        .settingsContainer {
          max-width: 1250px;
          margin: 0 auto;
        }

        .settingsHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 26px;
        }

        .settingsEyebrow {
          margin: 0 0 7px;
          color: var(--settings-blue);
          font-size: 11px;
          letter-spacing: 1.5px;
          font-weight: 900;
        }

        .settingsHeader h1 {
          margin: 0;
          font-size: 34px;
          letter-spacing: -1px;
        }

        .settingsHeader > div > span {
          display: block;
          max-width: 650px;
          margin-top: 9px;
          color: var(--settings-muted);
          font-size: 14px;
          line-height: 1.55;
        }

        .settingsHeaderActions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .primaryButton,
        .secondaryButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 15px;
          border-radius: 11px;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
        }

        .primaryButton {
          border: 1px solid var(--settings-blue);
          background: var(--settings-blue);
          color: #fff;
          box-shadow:
            0 8px 18px rgba(23,109,233,.17);
        }

        .secondaryButton {
          border: 1px solid #d8e1ed;
          background: #fff;
          color: #344054;
        }

        .settingsOverview {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 20px;
        }

        .settingsOverview article {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 92px;
          padding: 17px;
          border: 1px solid var(--settings-line);
          border-radius: 16px;
          background: #fff;
          box-shadow:
            0 6px 18px rgba(15,23,42,.025);
        }

        .overviewIcon {
          flex: 0 0 auto;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          font-weight: 900;
        }

        .overviewIcon.blue {
          background: #edf5ff;
          color: #176de9;
        }

        .overviewIcon.green {
          background: #e9f9f1;
          color: #16875b;
        }

        .overviewIcon.orange {
          background: #fff4e8;
          color: #d97706;
        }

        .overviewIcon.purple {
          background: #f3efff;
          color: #7c3aed;
        }

        .settingsOverview span {
          display: block;
          margin-bottom: 5px;
          color: #7a8799;
          font-size: 10px;
          font-weight: 800;
        }

        .settingsOverview strong {
          font-size: 18px;
        }

        .settingsPanel {
          padding: 23px;
          border: 1px solid var(--settings-line);
          border-radius: 20px;
          background: #fff;
          box-shadow:
            0 9px 26px rgba(15,23,42,.035);
        }

        .settingsPanelHead {
          margin-bottom: 18px;
        }

        .settingsPanelHead p {
          margin: 0 0 5px;
          color: var(--settings-blue);
          font-size: 10px;
          letter-spacing: 1.2px;
          font-weight: 900;
        }

        .settingsPanelHead h2 {
          margin: 0;
          font-size: 22px;
        }

        .settingsPanelHead span {
          display: block;
          margin-top: 5px;
          color: var(--settings-muted);
          font-size: 12px;
        }

        .settingsGrid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .settingsCard {
          display: flex;
          gap: 14px;
          min-height: 172px;
          padding: 17px;
          border: 1px solid #e3e9f1;
          border-radius: 16px;
          background:
            linear-gradient(
              180deg,
              #fff,
              #fbfcfe
            );
          color: inherit;
          text-decoration: none;
          transition:
            transform .17s ease,
            border-color .17s ease,
            box-shadow .17s ease;
        }

        .settingsCard:hover {
          transform: translateY(-2px);
          border-color: #b9d1f3;
          box-shadow:
            0 11px 26px
            rgba(30,64,110,.075);
        }

        .settingsCardIcon {
          flex: 0 0 auto;
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          font-size: 20px;
        }

        .settingsCardBody {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .settingsCardTitleRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 7px;
        }

        .settingsCard h3 {
          margin: 2px 0 0;
          font-size: 14px;
        }

        .settingsCard p {
          margin: 9px 0 13px;
          color: #718096;
          font-size: 11px;
          line-height: 1.55;
        }

        .settingsStatus {
          flex: 0 0 auto;
          padding: 5px 7px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 900;
        }

        .settingsStatus.active {
          background: #e8f8f0;
          color: #15805b;
        }

        .settingsStatus.neutral {
          background: #eef1f5;
          color: #697586;
        }

        .settingsStatus.warning {
          background: #fff4e7;
          color: #b86800;
        }

        .settingsCardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: auto;
          padding-top: 11px;
          border-top: 1px solid #edf1f5;
          color: var(--settings-blue);
          font-size: 10px;
          font-weight: 900;
        }

        .settingsCardFooter b {
          font-size: 15px;
        }

        .settingsInfo {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 18px;
          padding: 16px;
          border: 1px solid #d8e6f8;
          border-radius: 15px;
          background: #f6faff;
        }

        .settingsInfoIcon {
          flex: 0 0 auto;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #e2efff;
          color: #176de9;
          font-weight: 900;
        }

        .settingsInfo strong {
          font-size: 12px;
        }

        .settingsInfo p {
          margin: 4px 0 0;
          color: #60718b;
          font-size: 11px;
          line-height: 1.55;
        }

        @media (max-width: 980px) {
          .settingsOverview {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .settingsGrid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .settingsPage {
            padding: 20px 12px 30px;
          }

          .settingsHeader {
            display: block;
          }

          .settingsHeader h1 {
            font-size: 28px;
          }

          .settingsHeaderActions {
            margin-top: 17px;
          }

          .settingsHeaderActions a {
            flex: 1;
          }

          .settingsOverview {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .settingsOverview article {
            min-height: 80px;
            padding: 13px;
          }

          .overviewIcon {
            width: 36px;
            height: 36px;
          }

          .settingsPanel {
            padding: 15px 12px;
            border-radius: 17px;
          }

          .settingsGrid {
            grid-template-columns: 1fr;
          }

          .settingsCard {
            min-height: auto;
          }
        }

        @media (max-width: 390px) {
          .settingsOverview {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
