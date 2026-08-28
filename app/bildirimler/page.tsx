import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  message: string | null;
  category: string | null;
  notification_type: string;
  severity: string | null;
  priority: string | null;
  target_path: string | null;
  is_read: boolean;
  push_required: boolean;
  push_requested: boolean;
  push_sent: boolean;
  push_sent_at: string | null;
  created_at: string;
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

function categoryLabel(category?: string | null) {
  switch (category) {
    case "preregistration":
      return "Ön Kayıt";
    case "students":
      return "Öğrenciler";
    case "attendance":
      return "Yoklama";
    case "finance":
      return "Finans";
    case "payment":
      return "Ödemeler";
    case "cash":
      return "Kasa";
    case "approvals":
      return "Onaylar";
    case "staff":
      return "Personel";
    case "accounts":
      return "Kullanıcılar";
    case "permissions":
      return "Yetkiler";
    case "schedule":
      return "Ders Programı";
    case "operations":
      return "Operasyon";
    case "reports":
      return "Raporlar";
    case "system":
      return "Sistem";
    default:
      return category || "Sistem";
  }
}

function severityLabel(severity?: string | null) {
  switch (severity) {
    case "success":
      return "Başarılı";
    case "warning":
      return "Uyarı";
    case "error":
    case "critical":
      return "Kritik";
    default:
      return "Bilgi";
  }
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
  } = await supabase.auth.getUser();

  if (!user) {
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
      <main style={styles.errorPage}>
        <section style={styles.errorCard}>
          <div style={styles.errorIcon}>!</div>
          <h1 style={styles.errorTitle}>Bildirim Merkezi açılamadı</h1>
          <p style={styles.errorText}>
            Kullanıcı profili bulunamadı veya okunamadı.
          </p>
          <Link href="/" style={styles.primaryButton}>
            Ana Sayfaya Dön
          </Link>
        </section>
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
      .select("id, device_name, is_active, created_at, updated_at")
      .eq("organization_id", profile.organization_id)
      .eq("profile_id", profile.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const notifications =
    (notificationsResult.data as NotificationRow[] | null) ?? [];

  const devices = subscriptionsResult.data ?? [];

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  const todayKey = new Date().toLocaleDateString("tr-TR");

  const todayCount = notifications.filter((item) => {
    return (
      new Date(item.created_at).toLocaleDateString("tr-TR") === todayKey
    );
  }).length;

  const pushSentCount = notifications.filter(
    (item) => item.push_sent
  ).length;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>SPRINTOS • İLETİŞİM MERKEZİ</div>

            <h1 style={styles.title}>Bildirim Merkezi</h1>

            <p style={styles.subtitle}>
              Sprint Yüzme Okulu genelindeki bildirimleri, uyarıları ve
              telefon bildirimlerini tek merkezden yönetin.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link href="/" style={styles.secondaryButton}>
              ← Ana Sayfa
            </Link>

            <Link href="/uyarilar" style={styles.secondaryButton}>
              Uyarılar
            </Link>

            <Link href="/onay-merkezi" style={styles.primaryButton}>
              Onay Merkezi
            </Link>
          </div>
        </header>

        {notificationsResult.error ? (
          <div style={styles.warningBox}>
            <strong>Bildirimler okunamadı.</strong>
            <span>
              {" "}
              {notificationsResult.error.message}
            </span>
          </div>
        ) : null}

        <section style={styles.statsGrid}>
          <article style={styles.statCard}>
            <div style={styles.statIcon}>🔔</div>

            <div>
              <div style={styles.statLabel}>Okunmamış</div>
              <div style={styles.statValue}>{unreadCount}</div>
              <div style={styles.statDescription}>
                İşlem bekleyen bildirim
              </div>
            </div>
          </article>

          <article style={styles.statCard}>
            <div style={styles.statIcon}>📥</div>

            <div>
              <div style={styles.statLabel}>Bugün</div>
              <div style={styles.statValue}>{todayCount}</div>
              <div style={styles.statDescription}>
                Bugün oluşan bildirim
              </div>
            </div>
          </article>

          <article style={styles.statCard}>
            <div style={styles.statIcon}>📱</div>

            <div>
              <div style={styles.statLabel}>Aktif Cihaz</div>
              <div style={styles.statValue}>{devices.length}</div>
              <div style={styles.statDescription}>
                Push bildirimi alabilen cihaz
              </div>
            </div>
          </article>

          <article style={styles.statCard}>
            <div style={styles.statIcon}>✓</div>

            <div>
              <div style={styles.statLabel}>Push Gönderildi</div>
              <div style={styles.statValue}>{pushSentCount}</div>
              <div style={styles.statDescription}>
                Kayıtlı gönderim
              </div>
            </div>
          </article>
        </section>

        <section style={styles.layout}>
          <div style={styles.mainColumn}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.panelTitle}>
                    Tüm Bildirimler
                  </h2>

                  <p style={styles.panelSubtitle}>
                    Son 100 sistem bildirimi gösteriliyor.
                  </p>
                </div>

                <div style={styles.countBadge}>
                  {notifications.length} kayıt
                </div>
              </div>

              <div style={styles.filterRow}>
                <span style={styles.filterActive}>Tümü</span>
                <span style={styles.filter}>Okunmamış</span>
                <span style={styles.filter}>Ön Kayıt</span>
                <span style={styles.filter}>Yoklama</span>
                <span style={styles.filter}>Finans</span>
                <span style={styles.filter}>Onaylar</span>
                <span style={styles.filter}>Sistem</span>
              </div>

              {notifications.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>🔔</div>

                  <h3 style={styles.emptyTitle}>
                    Henüz bildirim bulunmuyor
                  </h3>

                  <p style={styles.emptyText}>
                    Modülleri merkezi bildirim motoruna bağladığımızda
                    ön kayıt, yoklama, ödeme, kasa, onay ve sistem
                    bildirimleri burada görüntülenecek.
                  </p>
                </div>
              ) : (
                <div style={styles.notificationList}>
                  {notifications.map((notification) => {
                    const content =
                      notification.body ||
                      notification.message ||
                      "Bildirim ayrıntısı bulunmuyor.";

                    const item = (
                      <article
                        style={{
                          ...styles.notificationCard,
                          ...(!notification.is_read
                            ? styles.notificationUnread
                            : {}),
                        }}
                      >
                        <div style={styles.notificationIcon}>
                          {notification.is_read ? "✓" : "🔔"}
                        </div>

                        <div style={styles.notificationContent}>
                          <div style={styles.notificationTop}>
                            <div style={styles.badges}>
                              <span style={styles.categoryBadge}>
                                {categoryLabel(
                                  notification.category
                                )}
                              </span>

                              <span style={styles.severityBadge}>
                                {severityLabel(
                                  notification.severity
                                )}
                              </span>

                              {!notification.is_read ? (
                                <span style={styles.unreadBadge}>
                                  Yeni
                                </span>
                              ) : null}

                              {notification.push_sent ? (
                                <span style={styles.pushBadge}>
                                  Push ✓
                                </span>
                              ) : null}
                            </div>

                            <time style={styles.dateText}>
                              {formatDate(
                                notification.created_at
                              )}
                            </time>
                          </div>

                          <h3 style={styles.notificationTitle}>
                            {notification.title}
                          </h3>

                          <p style={styles.notificationBody}>
                            {content}
                          </p>

                          {notification.target_path ? (
                            <div style={styles.openText}>
                              İlgili kaydı aç →
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );

                    if (notification.target_path) {
                      return (
                        <Link
                          href={notification.target_path}
                          key={notification.id}
                          style={styles.notificationLink}
                        >
                          {item}
                        </Link>
                      );
                    }

                    return (
                      <div key={notification.id}>
                        {item}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside style={styles.sideColumn}>
            <section style={styles.panel}>
              <div style={styles.sideHeader}>
                <div style={styles.sideIcon}>📱</div>

                <div>
                  <h2 style={styles.sideTitle}>
                    Push Cihazları
                  </h2>

                  <p style={styles.sideSubtitle}>
                    Bildirim alabilen cihazlar
                  </p>
                </div>
              </div>

              {subscriptionsResult.error ? (
                <div style={styles.smallWarning}>
                  Cihaz bilgileri okunamadı.
                </div>
              ) : devices.length === 0 ? (
                <div style={styles.deviceEmpty}>
                  Bu hesapta aktif push cihazı bulunmuyor.
                </div>
              ) : (
                <div style={styles.deviceList}>
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      style={styles.deviceCard}
                    >
                      <div style={styles.deviceDot} />

                      <div style={{ minWidth: 0 }}>
                        <div style={styles.deviceName}>
                          {device.device_name ||
                            "Bilinmeyen cihaz"}
                        </div>

                        <div style={styles.deviceStatus}>
                          Bildirimler aktif
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <h2 style={styles.sideTitle}>
                Bildirim Kaynakları
              </h2>

              <p style={styles.sideSubtitle}>
                Merkezi sisteme bağlanacak modüller
              </p>

              <div style={styles.sourceList}>
                {[
                  "Ön Kayıtlar",
                  "Öğrenciler",
                  "Yoklama",
                  "Ödemeler",
                  "Günlük Kasa",
                  "Onay Merkezi",
                  "Kullanıcı ve Yetkiler",
                  "Ders Programı",
                  "Operasyon Planı",
                  "Sistem",
                ].map((source) => (
                  <div
                    key={source}
                    style={styles.sourceRow}
                  >
                    <span>{source}</span>
                    <span style={styles.sourcePending}>
                      Hazırlanıyor
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.infoPanel}>
              <div style={styles.infoIcon}>ℹ️</div>

              <div>
                <strong style={styles.infoTitle}>
                  Merkezi Bildirim Sistemi
                </strong>

                <p style={styles.infoText}>
                  Bildirimler kullanıcı, yetki ve modül bazında
                  yönlendirilecek. Telefon push bildirimleri de aynı
                  kayıt üzerinden gönderilecek.
                </p>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    color: "#10213e",
    padding: "34px 22px 70px",
  },

  container: {
    width: "100%",
    maxWidth: "1480px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "24px",
    flexWrap: "wrap",
    marginBottom: "26px",
  },

  eyebrow: {
    color: "#1463df",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "1.5px",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    color: "#10213e",
    fontSize: "34px",
    lineHeight: 1.1,
    letterSpacing: "-0.8px",
  },

  subtitle: {
    margin: "10px 0 0",
    maxWidth: "760px",
    color: "#66758e",
    fontSize: "15px",
    lineHeight: 1.65,
  },

  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    padding: "0 17px",
    borderRadius: "12px",
    background: "#1264e8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: "14px",
    boxShadow: "0 8px 22px rgba(18,100,232,.18)",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    padding: "0 17px",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#223453",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: "14px",
    border: "1px solid #dfe6f1",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },

  statCard: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    padding: "20px",
    background: "#ffffff",
    border: "1px solid #e2e8f2",
    borderRadius: "18px",
    boxShadow: "0 8px 28px rgba(16,33,62,.045)",
  },

  statIcon: {
    width: "48px",
    height: "48px",
    flex: "0 0 48px",
    borderRadius: "14px",
    background: "#edf4ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "21px",
  },

  statLabel: {
    color: "#718099",
    fontSize: "12px",
    fontWeight: 800,
  },

  statValue: {
    marginTop: "2px",
    color: "#10213e",
    fontSize: "28px",
    fontWeight: 900,
  },

  statDescription: {
    marginTop: "2px",
    color: "#8793a8",
    fontSize: "11px",
  },

  layout: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1fr) minmax(280px, 340px)",
    gap: "20px",
    alignItems: "start",
  },

  mainColumn: {
    minWidth: 0,
  },

  sideColumn: {
    display: "grid",
    gap: "16px",
  },

  panel: {
    background: "#ffffff",
    border: "1px solid #e2e8f2",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 8px 30px rgba(16,33,62,.04)",
  },

  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    flexWrap: "wrap",
    paddingBottom: "17px",
    borderBottom: "1px solid #edf1f6",
  },

  panelTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#10213e",
  },

  panelSubtitle: {
    margin: "5px 0 0",
    color: "#8793a8",
    fontSize: "12px",
  },

  countBadge: {
    padding: "7px 11px",
    background: "#f2f6fc",
    color: "#60708b",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
  },

  filterRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    padding: "16px 0",
  },

  filter: {
    padding: "8px 12px",
    borderRadius: "999px",
    border: "1px solid #e2e8f2",
    color: "#687790",
    fontSize: "11px",
    fontWeight: 800,
  },

  filterActive: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#1264e8",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 800,
  },

  notificationList: {
    display: "grid",
    gap: "10px",
  },

  notificationLink: {
    textDecoration: "none",
    color: "inherit",
  },

  notificationCard: {
    display: "flex",
    gap: "14px",
    padding: "16px",
    border: "1px solid #e8edf4",
    borderRadius: "16px",
    background: "#ffffff",
  },

  notificationUnread: {
    background: "#f7faff",
    border: "1px solid #cfe0ff",
  },

  notificationIcon: {
    width: "42px",
    height: "42px",
    flex: "0 0 42px",
    borderRadius: "13px",
    background: "#edf4ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationContent: {
    flex: 1,
    minWidth: 0,
  },

  notificationTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },

  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },

  categoryBadge: {
    background: "#eaf2ff",
    color: "#145dcc",
    padding: "5px 8px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 900,
  },

  severityBadge: {
    background: "#f1f4f8",
    color: "#66758e",
    padding: "5px 8px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 900,
  },

  unreadBadge: {
    background: "#fff0e8",
    color: "#c95819",
    padding: "5px 8px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 900,
  },

  pushBadge: {
    background: "#e8f8ef",
    color: "#187347",
    padding: "5px 8px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 900,
  },

  dateText: {
    color: "#98a3b5",
    fontSize: "10px",
  },

  notificationTitle: {
    margin: "9px 0 5px",
    color: "#142540",
    fontSize: "14px",
  },

  notificationBody: {
    margin: 0,
    color: "#6d7a90",
    fontSize: "12px",
    lineHeight: 1.55,
  },

  openText: {
    marginTop: "9px",
    color: "#1264e8",
    fontSize: "11px",
    fontWeight: 900,
  },

  emptyState: {
    textAlign: "center",
    padding: "70px 20px",
  },

  emptyIcon: {
    fontSize: "35px",
    marginBottom: "12px",
  },

  emptyTitle: {
    margin: 0,
    fontSize: "17px",
  },

  emptyText: {
    maxWidth: "520px",
    margin: "9px auto 0",
    color: "#7d899e",
    fontSize: "12px",
    lineHeight: 1.65,
  },

  sideHeader: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "15px",
  },

  sideIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "13px",
    background: "#edf4ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  sideTitle: {
    margin: 0,
    color: "#142540",
    fontSize: "15px",
  },

  sideSubtitle: {
    margin: "4px 0 0",
    color: "#8a96aa",
    fontSize: "11px",
  },

  deviceList: {
    display: "grid",
    gap: "9px",
  },

  deviceCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px",
    background: "#f8fafc",
    borderRadius: "13px",
    border: "1px solid #edf1f5",
  },

  deviceDot: {
    width: "9px",
    height: "9px",
    flex: "0 0 9px",
    borderRadius: "50%",
    background: "#20a363",
    boxShadow: "0 0 0 4px rgba(32,163,99,.1)",
  },

  deviceName: {
    color: "#233652",
    fontSize: "12px",
    fontWeight: 900,
  },

  deviceStatus: {
    marginTop: "2px",
    color: "#20a363",
    fontSize: "10px",
    fontWeight: 700,
  },

  deviceEmpty: {
    color: "#8490a3",
    fontSize: "12px",
    lineHeight: 1.6,
  },

  sourceList: {
    display: "grid",
    gap: "4px",
    marginTop: "14px",
  },

  sourceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    padding: "10px 0",
    borderBottom: "1px solid #f0f2f6",
    color: "#42516a",
    fontSize: "11px",
    fontWeight: 700,
  },

  sourcePending: {
    color: "#9aa4b4",
    fontSize: "9px",
    fontWeight: 800,
  },

  infoPanel: {
    display: "flex",
    gap: "12px",
    padding: "17px",
    borderRadius: "18px",
    background: "#edf5ff",
    border: "1px solid #d5e5fb",
  },

  infoIcon: {
    fontSize: "17px",
  },

  infoTitle: {
    color: "#174d94",
    fontSize: "12px",
  },

  infoText: {
    margin: "5px 0 0",
    color: "#55749c",
    fontSize: "10px",
    lineHeight: 1.55,
  },

  warningBox: {
    marginBottom: "18px",
    padding: "14px 16px",
    background: "#fff6e8",
    border: "1px solid #f5d8aa",
    color: "#8c5b17",
    borderRadius: "13px",
    fontSize: "12px",
  },

  smallWarning: {
    color: "#a56a1b",
    fontSize: "11px",
  },

  errorPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f4f7fb",
    padding: "24px",
  },

  errorCard: {
    width: "100%",
    maxWidth: "500px",
    textAlign: "center",
    background: "#ffffff",
    padding: "35px",
    borderRadius: "22px",
    border: "1px solid #e2e8f2",
  },

  errorIcon: {
    width: "52px",
    height: "52px",
    margin: "0 auto 14px",
    borderRadius: "16px",
    background: "#fff0ee",
    color: "#d44235",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "22px",
  },

  errorTitle: {
    margin: 0,
    fontSize: "21px",
  },

  errorText: {
    color: "#748199",
    fontSize: "13px",
    margin: "9px 0 20px",
  },
};
