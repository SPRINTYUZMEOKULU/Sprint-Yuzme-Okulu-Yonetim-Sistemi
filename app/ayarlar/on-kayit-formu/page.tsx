import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

const settingGroups = [
  {
    title: "Katılımcı Bilgileri",
    description:
      "Çocuk ve yetişkin kayıtlarında gösterilecek temel alanları yönetin.",
    items: [
      "Kimin için kayıt?",
      "Ad Soyad",
      "Doğum Tarihi",
      "Telefon",
      "Veli Bilgileri",
    ],
  },
  {
    title: "Kurs Tercihleri",
    description:
      "Ön kayıt sırasında hangi kurs bilgilerinin sorulacağını belirleyin.",
    items: [
      "Kurs Türü",
      "Şube",
      "Grup / Gün / Saat",
      "Yüzme Seviyesi",
      "Paket Tercihi",
    ],
  },
  {
    title: "İletişim Talebi",
    description:
      "Kursiyerin ekibinizden nasıl dönüş istediğini belirten seçenekleri yönetin.",
    items: [
      "Beni Arayın",
      "WhatsApp Bilgisi",
      "Detaylı Bilgi",
      "Doğrudan Başlangıç",
    ],
  },
  {
    title: "Sağlık ve Özel Durum",
    description:
      "Sağlık beyanı, özel durum ve açıklama alanlarını yönetin.",
    items: [
      "Sağlık Beyanı",
      "Sağlık Açıklaması",
      "Özel Durum / Not",
    ],
  },
  {
    title: "Kurallar ve Onaylar",
    description:
      "Başvurunun tamamlanabilmesi için gerekli kabul ve bilgilendirmeleri yönetin.",
    items: [
      "Yüzme Okulu Kuralları",
      "Kuralları Kabul Ettim",
      "WhatsApp İzni",
      "Kabul Kayıtları",
    ],
  },
];

export default async function PreRegistrationSettingsPage() {
  await requireProfile([
    "owner",
    "admin",
  ]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
        color: "#14213d",
      }}
    >
      <div
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            marginBottom: "28px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#176de9",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "1.4px",
                marginBottom: "8px",
              }}
            >
              SPRINTOS · AYARLAR
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                letterSpacing: "-0.7px",
              }}
            >
              Ön Kayıt Formu Ayarları
            </h1>

            <p
              style={{
                margin: "9px 0 0",
                color: "#6f7f97",
                lineHeight: 1.6,
              }}
            >
              Ön kayıt formunda hangi alanların görüneceğini,
              hangilerinin zorunlu olacağını ve kursiyerin
              göreceği bilgilendirmeleri buradan yönetin.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/ayarlar"
              style={secondaryButton}
            >
              ← Genel Ayarlar
            </Link>

            <Link
              href="/on-kayit"
              target="_blank"
              style={primaryButton}
            >
              Formu Görüntüle ↗
            </Link>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          <article style={summaryCard}>
            <span style={summaryLabel}>
              Form Durumu
            </span>
            <strong
              style={{
                ...summaryValue,
                color: "#16875b",
              }}
            >
              Yayında
            </strong>
          </article>

          <article style={summaryCard}>
            <span style={summaryLabel}>
              Form Sürümü
            </span>
            <strong style={summaryValue}>
              v1
            </strong>
          </article>

          <article style={summaryCard}>
            <span style={summaryLabel}>
              Kurallar Sürümü
            </span>
            <strong style={summaryValue}>
              v1
            </strong>
          </article>

          <article style={summaryCard}>
            <span style={summaryLabel}>
              Elektronik Kabul
            </span>
            <strong
              style={{
                ...summaryValue,
                color: "#176de9",
              }}
            >
              Aktif
            </strong>
          </article>
        </section>

        <div
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          {settingGroups.map(
            (group) => (
              <section
                key={group.title}
                style={{
                  background: "#ffffff",
                  border:
                    "1px solid #e1e8f1",
                  borderRadius: "18px",
                  padding: "22px",
                  boxShadow:
                    "0 7px 20px rgba(20,33,61,0.04)",
                }}
              >
                <div
                  style={{
                    marginBottom: "17px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "18px",
                    }}
                  >
                    {group.title}
                  </h2>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#718096",
                      fontSize: "13px",
                    }}
                  >
                    {group.description}
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "9px",
                  }}
                >
                  {group.items.map(
                    (item) => (
                      <div
                        key={item}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: "15px",
                          padding:
                            "13px 14px",
                          background:
                            "#f8fafc",
                          border:
                            "1px solid #edf1f6",
                          borderRadius:
                            "12px",
                        }}
                      >
                        <strong
                          style={{
                            fontSize:
                              "13px",
                          }}
                        >
                          {item}
                        </strong>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: "6px",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <span
                            style={
                              activePill
                            }
                          >
                            Göster
                          </span>

                          <span
                            style={
                              neutralPill
                            }
                          >
                            Opsiyonel
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>
            )
          )}
        </div>

        <div
          style={{
            marginTop: "22px",
            padding: "18px",
            background: "#fff8ed",
            border: "1px solid #ffdca9",
            borderRadius: "15px",
          }}
        >
          <strong>
            Sonraki aşama
          </strong>

          <p
            style={{
              margin:
                "6px 0 0",
              color: "#775520",
              lineHeight: 1.55,
              fontSize: "13px",
            }}
          >
            Buradaki Göster / Gizle ve
            Zorunlu / Opsiyonel
            seçeneklerini Supabase'e
            bağlayacağız. Ardından ön
            kayıt formu bu ayarları
            otomatik okuyacak.
          </p>
        </div>
      </div>
    </main>
  );
}

const summaryCard = {
  background: "#ffffff",
  border: "1px solid #e1e8f1",
  borderRadius: "15px",
  padding: "17px",
};

const summaryLabel = {
  display: "block",
  color: "#718096",
  fontSize: "11px",
  fontWeight: 800,
  marginBottom: "7px",
};

const summaryValue = {
  fontSize: "18px",
  fontWeight: 900,
};

const primaryButton = {
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  background: "#176de9",
  color: "#ffffff",
  padding: "11px 15px",
  borderRadius: "11px",
  fontSize: "12px",
  fontWeight: 900,
};

const secondaryButton = {
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  background: "#ffffff",
  color: "#344054",
  border: "1px solid #dce4ee",
  padding: "11px 15px",
  borderRadius: "11px",
  fontSize: "12px",
  fontWeight: 800,
};

const activePill = {
  padding: "6px 9px",
  borderRadius: "999px",
  background: "#eaf3ff",
  color: "#176de9",
  fontSize: "10px",
  fontWeight: 900,
};

const neutralPill = {
  padding: "6px 9px",
  borderRadius: "999px",
  background: "#eef1f5",
  color: "#667085",
  fontSize: "10px",
  fontWeight: 900,
};
