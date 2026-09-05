import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import BildirimMerkeziClient, {
  type NotificationItem,
} from "./BildirimMerkeziClient";

export const dynamic = "force-dynamic";

type DeviceRow = {
  id: string;
  device_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase sunucu ayarları eksik.");
  }

  return createAdminClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function BildirimlerPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=/bildirimler");
  }

  const admin = getAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return (
      <main className="error-page">
        <section className="error-card">
          <div className="error-icon">!</div>

          <h1>Bildirim Merkezi açılamadı</h1>

          <p>
            Kullanıcı profili bulunamadı veya okunamadı.
          </p>

          <Link href="/" className="primary-link">
            Ana Sayfaya Dön
          </Link>
        </section>

        <style>{`
          .error-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f3f7fc;
            font-family: Arial, Helvetica, sans-serif;
          }

          .error-card {
            width: 100%;
            max-width: 520px;
            padding: 36px;
            border-radius: 24px;
            text-align: center;
            background: #ffffff;
            border: 1px solid #dfe7f2;
            box-shadow: 0 18px 50px rgba(23, 49, 87, 0.08);
          }

          .error-icon {
            width: 54px;
            height: 54px;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 16px;
            background: #fff0ee;
            color: #c84035;
            font-size: 24px;
            font-weight: 900;
          }

          .error-card h1 {
            margin: 0;
            color: #10213e;
            font-size: 22px;
          }

          .error-card p {
            margin: 10px 0 22px;
            color: #718099;
            font-size: 13px;
          }

          .primary-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            padding: 0 18px;
            border-radius: 13px;
            background: #1264e8;
            color: white;
            text-decoration: none;
            font-size: 13px;
            font-weight: 900;
          }
        `}</style>
      </main>
    );
  }

  const [
    notificationsResult,
    subscriptionsResult,
  ] = await Promise.all([
    admin
      .from("system_notifications")
      .select(
        `
          id,
          title,
          body,
          message,
          category,
          notification_type,
          severity,
          priority,
          target_path,
          is_read,
          push_required,
          push_requested,
          push_sent,
          push_sent_at,
          metadata,
          created_at
        `
      )
      .eq("organization_id", profile.organization_id)
      .or(
        `recipient_profile_id.eq.${profile.id},recipient_user_id.eq.${user.id},and(recipient_profile_id.is.null,recipient_user_id.is.null)`
      )
      .order("created_at", { ascending: false })
      .limit(100),

    admin
      .from("push_subscriptions")
      .select(
        "id, device_name, is_active, created_at, updated_at"
      )
      .eq("organization_id", profile.organization_id)
      .eq("profile_id", profile.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const notifications =
    ((notificationsResult.data as (NotificationItem & { metadata?: { reminder_at?: string } | null })[] | null) ?? [])
      .filter((item) => {
        if (item.notification_type !== "registration_note_reminder") return true;
        const reminderAt = item.metadata?.reminder_at;
        if (!reminderAt) return true;
        const time = new Date(reminderAt).getTime();
        return !Number.isFinite(time) || time <= Date.now();
      });

  const devices =
    (subscriptionsResult.data as DeviceRow[] | null) ?? [];

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  const todayKey = new Date().toLocaleDateString("tr-TR");

  const todayCount = notifications.filter((item) => {
    try {
      return (
        new Date(item.created_at).toLocaleDateString("tr-TR") ===
        todayKey
      );
    } catch {
      return false;
    }
  }).length;

  const pushSentCount = notifications.filter(
    (item) => item.push_sent
  ).length;

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-header">
          <div className="header-copy">
            <div className="eyebrow">
              SPRINTOS • İLETİŞİM MERKEZİ
            </div>

            <h1>Bildirim Merkezi</h1>

            <p>
              Sprint Yüzme Okulu genelindeki bilgi akışını,
              işlem bildirimlerini ve telefon bildirimlerini
              tek merkezden yönetin.
            </p>
          </div>

          <div className="header-actions">
            <Link
              href="/"
              className="header-button secondary"
            >
              <span>←</span>
              <span>Ana Sayfa</span>
            </Link>

            <Link
              href="/uyarilar"
              className="header-button warning"
            >
              <span>⚠</span>
              <span>Uyarılar</span>
            </Link>

            <Link
              href="/onay-merkezi"
              className="header-button primary"
            >
              <span>✓</span>
              <span>Onay Merkezi</span>
            </Link>
          </div>
        </header>

        {notificationsResult.error ? (
          <div className="warning-message">
            <strong>Bildirimler okunamadı.</strong>
            <span>
              {" "}
              {notificationsResult.error.message}
            </span>
          </div>
        ) : null}

        <section className="stats-grid">
          <article className="stat-card unread-stat">
            <div className="stat-icon">🔔</div>

            <div>
              <div className="stat-label">
                Okunmamış
              </div>

              <div className="stat-value">
                {unreadCount}
              </div>

              <div className="stat-description">
                İşlem bekleyen bildirim
              </div>
            </div>
          </article>

          <article className="stat-card today-stat">
            <div className="stat-icon">📥</div>

            <div>
              <div className="stat-label">
                Bugün
              </div>

              <div className="stat-value">
                {todayCount}
              </div>

              <div className="stat-description">
                Bugün oluşan bildirim
              </div>
            </div>
          </article>

          <article className="stat-card device-stat">
            <div className="stat-icon">📱</div>

            <div>
              <div className="stat-label">
                Aktif Cihaz
              </div>

              <div className="stat-value">
                {devices.length}
              </div>

              <div className="stat-description">
                Push bildirimi alabilen cihaz
              </div>
            </div>
          </article>

          <article className="stat-card push-stat">
            <div className="stat-icon">✓</div>

            <div>
              <div className="stat-label">
                Push Gönderildi
              </div>

              <div className="stat-value">
                {pushSentCount}
              </div>

              <div className="stat-description">
                Kayıtlı push gönderimi
              </div>
            </div>
          </article>
        </section>

        <section className="content-grid">
          <div className="main-column">
            <BildirimMerkeziClient
              notifications={notifications}
            />
          </div>

          <aside className="side-column">
            <section className="side-panel">
              <div className="side-panel-heading">
                <div className="side-icon">
                  📱
                </div>

                <div>
                  <h2>Push Cihazları</h2>
                  <p>
                    Bildirim alabilen cihazlar
                  </p>
                </div>
              </div>

              {subscriptionsResult.error ? (
                <div className="device-error">
                  Cihaz bilgileri okunamadı.
                </div>
              ) : devices.length === 0 ? (
                <div className="device-empty">
                  Bu hesapta aktif push cihazı
                  bulunmuyor.
                </div>
              ) : (
                <div className="device-list">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="device-card"
                    >
                      <div className="device-status-dot" />

                      <div className="device-copy">
                        <strong>
                          {device.device_name ||
                            "Bilinmeyen cihaz"}
                        </strong>

                        <span>
                          Bildirimler aktif
                        </span>

                        <small>
                          Son güncelleme:{" "}
                          {formatDate(
                            device.updated_at
                          )}
                        </small>
                      </div>

                      <div className="active-badge">
                        Aktif
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="side-panel">
              <div className="source-heading">
                <h2>Bildirim Kaynakları</h2>

                <p>
                  Merkezi sisteme bağlanacak modüller
                </p>
              </div>

              <div className="source-list">
                {[
                  {
                    label: "Ön Kayıtlar",
                    icon: "＋",
                  },
                  {
                    label: "Öğrenciler",
                    icon: "◉",
                  },
                  {
                    label: "Yoklama",
                    icon: "✓",
                  },
                  {
                    label: "Ödemeler",
                    icon: "₺",
                  },
                  {
                    label: "Günlük Kasa",
                    icon: "▣",
                  },
                  {
                    label: "Onay Merkezi",
                    icon: "◎",
                  },
                  {
                    label:
                      "Kullanıcı ve Yetkiler",
                    icon: "♙",
                  },
                  {
                    label: "Ders Programı",
                    icon: "▦",
                  },
                  {
                    label: "Operasyon Planı",
                    icon: "⌘",
                  },
                  {
                    label: "Sistem",
                    icon: "⚙",
                  },
                ].map((source) => (
                  <div
                    key={source.label}
                    className="source-row"
                  >
                    <div className="source-name">
                      <span className="source-icon">
                        {source.icon}
                      </span>

                      <span>
                        {source.label}
                      </span>
                    </div>

                    <span className="source-status">
                      Hazırlanıyor
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="info-panel">
              <div className="info-icon">
                ℹ
              </div>

              <div>
                <strong>
                  Merkezi Bildirim Sistemi
                </strong>

                <p>
                  Bildirimler kullanıcı, yetki ve
                  modül bazında yönlendirilecek.
                  Telefon push bildirimleri de aynı
                  kayıt üzerinden yönetilecek.
                </p>
              </div>
            </section>
          </aside>
        </section>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .page-shell {
          min-height: 100vh;
          padding: 34px 22px 70px;
          background:
            radial-gradient(
              circle at top right,
              rgba(37, 109, 232, 0.05),
              transparent 31%
            ),
            #f3f7fc;
          color: #10213e;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        .page-container {
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
          margin-bottom: 25px;
        }

        .header-copy {
          max-width: 760px;
        }

        .eyebrow {
          margin-bottom: 8px;
          color: #1264df;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 1.5px;
        }

        .page-header h1 {
          margin: 0;
          color: #10213e;
          font-size: 35px;
          line-height: 1.05;
          letter-spacing: -1px;
          font-weight: 950;
        }

        .page-header p {
          margin: 10px 0 0;
          color: #687891;
          font-size: 14px;
          line-height: 1.65;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .header-button {
          min-height: 45px;
          padding: 0 15px;
          border-radius: 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
          border: 1px solid;
          transition:
            transform 0.14s ease,
            box-shadow 0.14s ease,
            background 0.14s ease,
            border-color 0.14s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .header-button.secondary {
          color: #334861;
          background: #ffffff;
          border-color: #dbe4ef;
        }

        .header-button.secondary:hover {
          background: #f6f9fd;
          border-color: #c8d5e5;
          transform: translateY(-2px);
          box-shadow:
            0 9px 20px rgba(26, 51, 86, 0.08);
        }

        .header-button.warning {
          color: #a96109;
          background: #fff7e8;
          border-color: #f0d8ad;
        }

        .header-button.warning:hover {
          background: #ffefcf;
          border-color: #e8c78a;
          transform: translateY(-2px);
          box-shadow:
            0 9px 20px rgba(176, 111, 22, 0.1);
        }

        .header-button.primary {
          color: white;
          background:
            linear-gradient(
              135deg,
              #176de9,
              #0753c8
            );
          border-color: #0753c8;
          box-shadow:
            0 10px 22px rgba(18, 93, 213, 0.2);
        }

        .header-button.primary:hover {
          transform: translateY(-2px);
          box-shadow:
            0 14px 28px rgba(18, 93, 213, 0.26);
        }

        .header-button:active {
          transform: translateY(1px) scale(0.97);
          box-shadow:
            inset 0 3px 8px rgba(0, 0, 0, 0.1);
        }

        .warning-message {
          margin-bottom: 18px;
          padding: 14px 16px;
          border-radius: 14px;
          color: #955e15;
          background: #fff6e8;
          border: 1px solid #f1d6a7;
          font-size: 12px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0, 1fr)
            );
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat-card {
          position: relative;
          min-height: 108px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          overflow: hidden;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid #dfe7f2;
          box-shadow:
            0 12px 34px rgba(20, 46, 82, 0.05);
          transition:
            transform 0.16s ease,
            box-shadow 0.16s ease,
            border-color 0.16s ease;
        }

        .stat-card::after {
          content: "";
          position: absolute;
          width: 85px;
          height: 85px;
          right: -25px;
          bottom: -36px;
          border-radius: 50%;
          opacity: 0.55;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 17px 38px rgba(20, 46, 82, 0.075);
        }

        .unread-stat::after {
          background: #fff0e6;
        }

        .today-stat::after {
          background: #eaf2ff;
        }

        .device-stat::after {
          background: #e8f8ef;
        }

        .push-stat::after {
          background: #eeeaff;
        }

        .stat-icon {
          width: 49px;
          height: 49px;
          flex: 0 0 49px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 15px;
          background: #edf4ff;
          font-size: 20px;
          border: 1px solid #deebfc;
        }

        .stat-label {
          color: #728098;
          font-size: 11px;
          font-weight: 900;
        }

        .stat-value {
          margin-top: 2px;
          color: #10213e;
          font-size: 29px;
          font-weight: 950;
          line-height: 1;
        }

        .stat-description {
          margin-top: 5px;
          color: #909bae;
          font-size: 10px;
        }

        .content-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            330px;
          gap: 20px;
          align-items: start;
        }

        .main-column {
          min-width: 0;
        }

        .side-column {
          display: grid;
          gap: 16px;
        }

        .side-panel {
          padding: 20px;
          border-radius: 21px;
          background:
            linear-gradient(
              180deg,
              #ffffff,
              #fbfdff
            );
          border: 1px solid #dfe7f2;
          box-shadow:
            0 12px 34px rgba(20, 46, 82, 0.045);
        }

        .side-panel-heading {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 15px;
        }

        .side-icon {
          width: 43px;
          height: 43px;
          flex: 0 0 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: #edf4ff;
          border: 1px solid #deebfc;
          font-size: 18px;
        }

        .side-panel h2 {
          margin: 0;
          color: #172b47;
          font-size: 15px;
          font-weight: 950;
        }

        .side-panel p {
          margin: 4px 0 0;
          color: #8a96a9;
          font-size: 10px;
          line-height: 1.5;
        }

        .device-list {
          display: grid;
          gap: 9px;
        }

        .device-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #ebeff4;
          transition:
            transform 0.14s ease,
            border-color 0.14s ease,
            background 0.14s ease;
        }

        .device-card:hover {
          transform: translateY(-1px);
          background: #f4f8fd;
          border-color: #d9e4f2;
        }

        .device-status-dot {
          width: 9px;
          height: 9px;
          flex: 0 0 9px;
          border-radius: 50%;
          background: #25a464;
          box-shadow:
            0 0 0 4px rgba(37, 164, 100, 0.12);
        }

        .device-copy {
          flex: 1;
          min-width: 0;
        }

        .device-copy strong {
          display: block;
          color: #263a57;
          font-size: 11px;
          font-weight: 950;
        }

        .device-copy span {
          display: block;
          margin-top: 2px;
          color: #24915d;
          font-size: 9px;
          font-weight: 800;
        }

        .device-copy small {
          display: block;
          margin-top: 4px;
          color: #96a1b2;
          font-size: 8px;
        }

        .active-badge {
          padding: 5px 7px;
          border-radius: 999px;
          color: #19784b;
          background: #e8f8ef;
          border: 1px solid #cbead8;
          font-size: 8px;
          font-weight: 950;
        }

        .device-empty,
        .device-error {
          padding: 12px;
          border-radius: 12px;
          font-size: 10px;
          line-height: 1.55;
        }

        .device-empty {
          color: #8190a6;
          background: #f7f9fc;
        }

        .device-error {
          color: #a46214;
          background: #fff6e8;
        }

        .source-heading {
          padding-bottom: 13px;
          border-bottom: 1px solid #edf1f6;
        }

        .source-list {
          display: grid;
          margin-top: 8px;
        }

        .source-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 43px;
          border-bottom: 1px solid #f0f3f7;
          color: #40516c;
          font-size: 10px;
          font-weight: 800;
        }

        .source-name {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .source-icon {
          width: 24px;
          height: 24px;
          border-radius: 8px;
          background: #f2f6fc;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #55729c;
          font-size: 10px;
        }

        .source-status {
          color: #96a1b2;
          font-size: 8px;
          font-weight: 850;
        }

        .info-panel {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 17px;
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              #edf5ff,
              #f6faff
            );
          border: 1px solid #d4e5fb;
        }

        .info-icon {
          width: 29px;
          height: 29px;
          flex: 0 0 29px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1264df;
          background: #ffffff;
          font-weight: 950;
        }

        .info-panel strong {
          color: #194f94;
          font-size: 11px;
          font-weight: 950;
        }

        .info-panel p {
          margin: 5px 0 0;
          color: #59769c;
          font-size: 9px;
          line-height: 1.55;
        }

        @media (max-width: 1120px) {
          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .content-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .info-panel {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .page-shell {
            padding: 22px 13px 55px;
          }

          .page-header h1 {
            font-size: 29px;
          }

          .header-actions {
            width: 100%;
            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .header-button {
            padding: 0 9px;
            font-size: 10px;
          }

          .stats-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .stat-card {
            min-height: 99px;
            padding: 14px;
            gap: 10px;
          }

          .stat-icon {
            width: 42px;
            height: 42px;
            flex-basis: 42px;
            border-radius: 13px;
          }

          .stat-value {
            font-size: 25px;
          }

          .side-column {
            grid-template-columns: 1fr;
          }

          .info-panel {
            grid-column: auto;
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .page-header h1 {
            font-size: 27px;
          }
        }
      `}</style>
    </main>
  );
}
