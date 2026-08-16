import Link from "next/link";

import {
  requireProfile,
} from "@/lib/auth/profile";

import {
  createClient,
} from "@/lib/supabase/server";

import FormSettingsClient, {
  type FormField,
} from "./form-settings-client";

export const dynamic =
  "force-dynamic";

export default async function PreRegistrationSettingsPage() {
  const profile =
    await requireProfile([
      "owner",
      "admin",
    ]);

  if (!profile.organization_id) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f4f7fb",
          padding: "32px",
          fontFamily:
            "Arial, sans-serif",
          color: "#14213d",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#fff2f2",
              border:
                "1px solid #ffd2d2",
              borderRadius: 18,
              padding: 24,
              color: "#a32f2f",
              fontWeight: 800,
            }}
          >
            Kullanıcı hesabınız bir
            kuruma bağlı değil.
            Ön kayıt formu ayarları
            açılamadı.
          </div>
        </div>
      </main>
    );
  }

  const supabase =
    await createClient();

  const {
    data: fields,
    error,
  } =
    await supabase
      .from(
        "registration_form_fields"
      )
      .select(
        `
        id,
        field_key,
        section_key,
        label,
        field_type,
        placeholder,
        help_text,
        options,
        is_visible,
        is_required,
        is_system,
        is_deletable,
        applies_to,
        sort_order
        `
      )
      .eq(
        "organization_id",
        profile.organization_id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      );

  const formFields =
    (fields || []) as FormField[];

  const totalFields =
    formFields.length;

  const visibleFields =
    formFields.filter(
      (field) =>
        field.is_visible
    ).length;

  const requiredFields =
    formFields.filter(
      (field) =>
        field.is_visible &&
        field.is_required
    ).length;

  const customFields =
    formFields.filter(
      (field) =>
        !field.is_system
    ).length;

  return (
    <main
      style={{
        minHeight: "100vh",

        background:
          "radial-gradient(circle at 8% 0%, rgba(23,109,233,.08), transparent 28%), #f4f7fb",

        padding:
          "32px 22px 60px",

        fontFamily:
          "Arial, sans-serif",

        color:
          "#14213d",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <header
          style={{
            display: "flex",

            justifyContent:
              "space-between",

            alignItems:
              "flex-start",

            gap: 20,

            marginBottom: 26,

            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color:
                  "#176de9",

                fontSize:
                  11,

                fontWeight:
                  900,

                letterSpacing:
                  1.5,

                marginBottom:
                  8,
              }}
            >
              SPRINTOS · AYARLAR
            </div>

            <h1
              style={{
                margin: 0,

                fontSize:
                  34,

                letterSpacing:
                  "-0.8px",

                color:
                  "#10264b",
              }}
            >
              Ön Kayıt Formu
              Ayarları
            </h1>

            <p
              style={{
                margin:
                  "9px 0 0",

                maxWidth:
                  720,

                color:
                  "#6f7f97",

                lineHeight:
                  1.65,

                fontSize:
                  14,
              }}
            >
              Ön kayıt
              formunda hangi
              alanların
              görüneceğini,
              hangilerinin
              zorunlu olacağını
              ve kursiyerin
              göreceği alan
              başlıklarını
              buradan yönetin.
              İsterseniz yeni
              alanlar da
              ekleyebilirsiniz.
            </p>
          </div>

          <div
            style={{
              display:
                "flex",

              gap:
                10,

              flexWrap:
                "wrap",
            }}
          >
            <Link
              href="/ayarlar"
              style={
                secondaryButton
              }
            >
              ← Genel Ayarlar
            </Link>

            <Link
              href="/on-kayit"
              target="_blank"
              style={
                primaryButton
              }
            >
              Formu Görüntüle ↗
            </Link>
          </div>
        </header>

        {/* ÖZET */}

        <section
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(200px,1fr))",

            gap: 14,

            marginBottom:
              24,
          }}
        >
          <article
            style={
              summaryCard
            }
          >
            <span
              style={
                summaryLabel
              }
            >
              Form Durumu
            </span>

            <strong
              style={{
                ...summaryValue,
                color:
                  "#16875b",
              }}
            >
              Yayında
            </strong>
          </article>

          <article
            style={
              summaryCard
            }
          >
            <span
              style={
                summaryLabel
              }
            >
              Toplam Alan
            </span>

            <strong
              style={
                summaryValue
              }
            >
              {totalFields}
            </strong>
          </article>

          <article
            style={
              summaryCard
            }
          >
            <span
              style={
                summaryLabel
              }
            >
              Görünen Alan
            </span>

            <strong
              style={{
                ...summaryValue,
                color:
                  "#176de9",
              }}
            >
              {visibleFields}
            </strong>
          </article>

          <article
            style={
              summaryCard
            }
          >
            <span
              style={
                summaryLabel
              }
            >
              Zorunlu Alan
            </span>

            <strong
              style={{
                ...summaryValue,
                color:
                  "#ed7b00",
              }}
            >
              {requiredFields}
            </strong>
          </article>

          <article
            style={
              summaryCard
            }
          >
            <span
              style={
                summaryLabel
              }
            >
              Özel Alan
            </span>

            <strong
              style={{
                ...summaryValue,
                color:
                  "#7b4ce1",
              }}
            >
              {customFields}
            </strong>
          </article>
        </section>

        {/* HATA */}

        {error ? (
          <div
            style={{
              marginBottom:
                20,

              padding:
                18,

              background:
                "#fff1f1",

              border:
                "1px solid #ffd0d0",

              borderRadius:
                15,

              color:
                "#b83838",

              fontWeight:
                700,
            }}
          >
            Form ayarları
            Supabase&apos;ten
            okunamadı:{" "}
            {error.message}
          </div>
        ) : null}

        {/* ANA EDİTÖR */}

        <FormSettingsClient
          fields={
            formFields
          }
        />

        {/* BİLGİ */}

        <div
          style={{
            marginTop:
              24,

            padding:
              18,

            background:
              "#eef6ff",

            border:
              "1px solid #cfe1fa",

            borderRadius:
              15,

            color:
              "#3c5f8d",

            fontSize:
              13,

            lineHeight:
              1.6,
          }}
        >
          <strong>
            Dinamik form sistemi
            aktif
          </strong>

          <p
            style={{
              margin:
                "6px 0 0",
            }}
          >
            Burada yaptığınız
            değişiklikler
            Supabase&apos;e
            kaydedilir.
            Bir sonraki aşamada
            ön kayıt formunun
            kendisini de bu
            ayarları okuyacak
            şekilde bağlayacağız.
            Böylece örneğin Doğum
            Tarihi&apos;ni
            zorunlu veya
            opsiyonel yapmanız
            doğrudan canlı forma
            yansıyacak.
          </p>
        </div>
      </div>
    </main>
  );
}

const summaryCard = {
  background:
    "#ffffff",

  border:
    "1px solid #e1e8f1",

  borderRadius:
    15,

  padding:
    17,

  boxShadow:
    "0 7px 20px rgba(20,33,61,.035)",
};

const summaryLabel = {
  display:
    "block",

  color:
    "#718096",

  fontSize:
    11,

  fontWeight:
    800,

  marginBottom:
    7,
};

const summaryValue = {
  fontSize:
    19,

  fontWeight:
    900,

  color:
    "#14213d",
};

const primaryButton = {
  display:
    "inline-flex",

  alignItems:
    "center",

  textDecoration:
    "none",

  background:
    "#176de9",

  color:
    "#ffffff",

  padding:
    "11px 15px",

  borderRadius:
    11,

  fontSize:
    12,

  fontWeight:
    900,

  boxShadow:
    "0 7px 15px rgba(23,109,233,.18)",
};

const secondaryButton = {
  display:
    "inline-flex",

  alignItems:
    "center",

  textDecoration:
    "none",

  background:
    "#ffffff",

  color:
    "#344054",

  border:
    "1px solid #dce4ee",

  padding:
    "11px 15px",

  borderRadius:
    11,

  fontSize:
    12,

  fontWeight:
    800,
};
