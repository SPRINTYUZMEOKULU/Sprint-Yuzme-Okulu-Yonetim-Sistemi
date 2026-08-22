import Link from "next/link";

export const dynamic = "force-dynamic";

const bolumler = [
  {
    baslik: "Veliler",
    aciklama: "Veli hesaplarını, giriş yöntemlerini ve erişim yetkilerini yönetin.",
    simge: "👨‍👩‍👧",
    href: "/veliler",
  },
  {
    baslik: "Eğitmenler",
    aciklama: "Eğitmen hesaplarını ve sistem erişimlerini yönetin.",
    simge: "🏊",
    href: "/kullanicilar-ve-yetkiler",
  },
  {
    baslik: "Personel",
    aciklama: "Kayıt, muhasebe ve diğer personelin yetkilerini belirleyin.",
    simge: "👤",
    href: "/kullanicilar-ve-yetkiler",
  },
  {
    baslik: "Yöneticiler",
    aciklama: "Yönetici hesaplarını ve yönetim yetkilerini kontrol edin.",
    simge: "🛡️",
    href: "/kullanicilar-ve-yetkiler",
  },
];

const yetkiAlanlari = [
  "Ana Sayfa",
  "Ön Kayıtlar",
  "Öğrenciler",
  "Veliler",
  "Şubeler",
  "Gruplar",
  "Ders Programı",
  "Yoklama",
  "Paketler",
  "Günlük Kasa",
  "Ödemeler",
  "Hazır Mesajlar",
  "Uyarılar",
  "Onay Merkezi",
];

export default function KullanicilarVeYetkilerPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fc",
        padding: "32px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#13233f",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
        }}
      >
        {/* ÜST ALAN */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom: "28px",
          }}
        >
          <div>
            <div
              style={{
                color: "#1769e8",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "1.5px",
                marginBottom: "8px",
              }}
            >
              SPRİNT YÜZME OKULU
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: 800,
              }}
            >
              Kullanıcılar ve Yetkiler
            </h1>

            <p
              style={{
                margin: "8px 0 0",
                color: "#64748b",
                fontSize: "15px",
              }}
            >
              Veli, eğitmen, personel ve yönetici hesaplarını tek merkezden
              yönetin.
            </p>
          </div>

          <Link
            href="/"
            style={{
              textDecoration: "none",
              background: "#ffffff",
              color: "#1769e8",
              border: "1px solid #dce5f2",
              borderRadius: "12px",
              padding: "12px 18px",
              fontWeight: 700,
              boxShadow: "0 4px 15px rgba(15, 23, 42, 0.05)",
            }}
          >
            ← Ana Sayfaya Dön
          </Link>
        </div>

        {/* HESAP TÜRLERİ */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {bolumler.map((bolum) => (
            <Link
              key={bolum.baslik}
              href={bolum.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                background: "#ffffff",
                border: "1px solid #e1e8f2",
                borderRadius: "18px",
                padding: "22px",
                boxShadow: "0 8px 25px rgba(15, 23, 42, 0.05)",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "#edf5ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  marginBottom: "16px",
                }}
              >
                {bolum.simge}
              </div>

              <h2
                style={{
                  margin: "0 0 7px",
                  fontSize: "18px",
                }}
              >
                {bolum.baslik}
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {bolum.aciklama}
              </p>
            </Link>
          ))}
        </section>

        {/* GİRİŞ VE GÜVENLİK */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e1e8f2",
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 8px 25px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
              }}
            >
              Giriş ve Güvenlik Yönetimi
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Kullanıcıların SprintOS&apos;a hangi yöntemlerle giriş
              yapabileceğini yönetin.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "14px",
            }}
          >
            {[
              ["E-posta ile Giriş", "Kullanıcının e-posta ve şifre ile giriş yetkisi."],
              ["Telefon ile Giriş", "Telefon numarasıyla giriş yetkisinin yönetimi."],
              ["Şifre İşlemleri", "Şifre sıfırlama taleplerini yönetin."],
              ["Hesap Durumu", "Hesabı etkinleştirin veya erişimi durdurun."],
            ].map(([baslik, aciklama]) => (
              <div
                key={baslik}
                style={{
                  border: "1px solid #e5ebf4",
                  borderRadius: "14px",
                  padding: "17px",
                  background: "#fbfcfe",
                }}
              >
                <div
                  style={{
                    fontWeight: 750,
                    marginBottom: "6px",
                  }}
                >
                  {baslik}
                </div>

                <div
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  {aciklama}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ŞİFREMİ UNUTTUM */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e1e8f2",
              borderRadius: "20px",
              padding: "24px",
              boxShadow: "0 8px 25px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "#f97316",
                letterSpacing: "1px",
                marginBottom: "8px",
              }}
            >
              BİLDİRİMLER
            </div>

            <h2
              style={{
                margin: "0 0 8px",
                fontSize: "20px",
              }}
            >
              Şifre Sıfırlama Talepleri
            </h2>

            <p
              style={{
                color: "#64748b",
                fontSize: "14px",
                lineHeight: 1.6,
                marginBottom: "18px",
              }}
            >
              Giriş ekranındaki “Şifremi unuttum” işlemleri burada
              görüntülenecek.
            </p>

            <div
              style={{
                border: "1px dashed #cfd9e8",
                borderRadius: "14px",
                padding: "22px",
                textAlign: "center",
                color: "#64748b",
                background: "#fafcff",
              }}
            >
              Bekleyen şifre talebi bulunmuyor.
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e1e8f2",
              borderRadius: "20px",
              padding: "24px",
              boxShadow: "0 8px 25px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "#1769e8",
                letterSpacing: "1px",
                marginBottom: "8px",
              }}
            >
              HESAP OLUŞTURMA
            </div>

            <h2
              style={{
                margin: "0 0 8px",
                fontSize: "20px",
              }}
            >
              Yeni Kullanıcı Yetkilendir
            </h2>

            <p
              style={{
                color: "#64748b",
                fontSize: "14px",
                lineHeight: 1.6,
                marginBottom: "18px",
              }}
            >
              Sisteme eklenen veli, eğitmen veya personele giriş yetkisi
              tanımlayın.
            </p>

            <button
              type="button"
              style={{
                width: "100%",
                border: 0,
                borderRadius: "12px",
                padding: "14px 18px",
                background: "#1769e8",
                color: "#ffffff",
                fontWeight: 750,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              + Kullanıcı Yetkilendir
            </button>
          </div>
        </section>

        {/* MODÜL YETKİLERİ */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e1e8f2",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 8px 25px rgba(15, 23, 42, 0.05)",
          }}
        >
          <h2
            style={{
              margin: "0 0 7px",
              fontSize: "20px",
            }}
          >
            Modül Yetkileri
          </h2>

          <p
            style={{
              margin: "0 0 20px",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Personelin SprintOS içerisinde hangi bölümlere erişebileceğini
            belirlemek için kullanılacak.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
            }}
          >
            {yetkiAlanlari.map((alan) => (
              <div
                key={alan}
                style={{
                  border: "1px solid #e4eaf3",
                  borderRadius: "12px",
                  padding: "13px 14px",
                  background: "#fbfcfe",
                  fontSize: "14px",
                  fontWeight: 650,
                }}
              >
                ✓ {alan}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
