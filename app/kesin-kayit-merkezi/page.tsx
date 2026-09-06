import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import RegistrationCenterFeedback from "./registration-center-feedback";
import "../dashboard.css";

export const dynamic = "force-dynamic";

const allowedRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

export default async function DefinitiveRegistrationCenter({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile([...allowedRoles]);
  const query = await searchParams;
  const search = text(query.q).toLocaleLowerCase("tr-TR");
  const supabase = await createClient();

  if (!profile.organization_id) {
    return (
      <main className="registrationPage">
        <section className="registrationCard">Organizasyon bilgisi bulunamadı.</section>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("students")
    .select("id,student_number,first_name,last_name,phone,guardian_name,guardian_phone,status,created_at")
    .eq("organization_id", profile.organization_id)
    .in("status", ["pre_registration", "waiting_payment", "waiting_approval"])
    .order("created_at", { ascending: false })
    .limit(300);

  const allRows = data || [];
  const rows = allRows.filter((student: any) => {
    if (!search) return true;
    const haystack = [
      student.student_number,
      student.first_name,
      student.last_name,
      student.phone,
      student.guardian_name,
      student.guardian_phone,
    ]
      .map(text)
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    return haystack.includes(search);
  });

  const statusLabels: Record<string, string> = {
    pre_registration: "Kesin Kayıt Bekliyor",
    waiting_payment: "Ödeme Bekliyor",
    waiting_approval: "Onay Bekliyor",
  };

  return (
    <main data-registration-center style={{ minHeight: "100vh", background: "#f4f7fb", padding: "24px" }}>
      <RegistrationCenterFeedback />
      <section style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header
          style={{
            background: "#fff",
            border: "1px solid #dce6f2",
            borderRadius: 22,
            padding: 24,
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ margin: 0, color: "#176fe8", fontSize: 12, fontWeight: 900, letterSpacing: 1.6 }}>
              SPRİNTOS · KAYIT OPERASYONU
            </p>
            <h1 style={{ margin: "8px 0 6px", color: "#102b4d" }}>Kesin Kayıt Merkezi</h1>
            <p style={{ margin: 0, color: "#6c7f96", maxWidth: 720 }}>
              Ön kayıttan kesin kayda geçecek kursiyerleri bulun, ödeme-vade ve program bilgilerini tamamlayarak kayıt dosyasını açın.
            </p>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 999, background: "#eaf3ff", color: "#155fbf", fontSize: 13, fontWeight: 900 }}>
                Kesin kayıt bekleyen: {allRows.length} öğrenci
              </span>
              {search ? (
                <span style={{ display: "inline-flex", alignItems: "center", padding: "8px 12px", borderRadius: 999, background: "#f2f5f9", color: "#586e88", fontSize: 13, fontWeight: 850 }}>
                  Arama sonucu: {rows.length} öğrenci
                </span>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <Link data-action-feedback="default" href="/on-kayitlar" style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid #d7e3f1", background: "#fff", color: "#294a70", textDecoration: "none", fontWeight: 850 }}>
              Ön Kayıt Merkezi
            </Link>
            <Link data-action-feedback="default" href="/ogrenciler" style={{ padding: "11px 14px", borderRadius: 12, background: "#176fe8", color: "#fff", textDecoration: "none", fontWeight: 850 }}>
              Öğrenci Merkezi
            </Link>
          </div>
        </header>

        <form method="get" style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <input
            name="q"
            defaultValue={query.q || ""}
            placeholder="Kursiyer, veli, telefon veya öğrenci numarası ara..."
            style={{ flex: 1, minHeight: 48, border: "1px solid #d4e0ee", borderRadius: 14, padding: "0 15px", background: "#fff", color: "#173654", fontSize: 15 }}
          />
          <button data-action-feedback="default" type="submit" style={{ border: 0, borderRadius: 14, padding: "0 20px", background: "#102f55", color: "#fff", fontWeight: 900 }}>
            Ara
          </button>
        </form>

        {error ? (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 14, background: "#fff1f1", color: "#a92d37" }}>
            Kayıt adayları alınamadı: {error.message}
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {rows.map((student: any) => {
            const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "İsimsiz Kursiyer";
            return (
              <article
                key={student.id}
                style={{
                  background: "#fff",
                  border: "1px solid #dce6f2",
                  borderRadius: 18,
                  padding: 18,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ color: "#102e50", fontSize: 18 }}>{fullName}</strong>
                    <span style={{ padding: "5px 9px", borderRadius: 999, background: "#eef5ff", color: "#1761bd", fontSize: 11, fontWeight: 900 }}>
                      {statusLabels[student.status] || student.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, color: "#70839a", fontSize: 13, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>No: {student.student_number || "Henüz yok"}</span>
                    <span>Veli: {student.guardian_name || "—"}</span>
                    <span>Tel: {student.guardian_phone || student.phone || "—"}</span>
                  </div>
                </div>
                <Link
                  data-action-feedback="open-registration"
                  href={`/kayit-tamamlama/${student.id}`}
                  style={{ padding: "12px 15px", borderRadius: 13, background: "#176fe8", color: "#fff", textDecoration: "none", fontWeight: 900, whiteSpace: "nowrap", minWidth: 168, textAlign: "center" }}
                >
                  Kesin Kaydı Aç →
                </Link>
              </article>
            );
          })}

          {!rows.length && !error ? (
            <div style={{ padding: 28, border: "1px dashed #c8d8ea", borderRadius: 18, background: "#fff", color: "#657a92", textAlign: "center" }}>
              {search ? "Aramanızla eşleşen kesin kayıt adayı bulunamadı." : "Kesin kayıt bekleyen kursiyer bulunmuyor."}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
