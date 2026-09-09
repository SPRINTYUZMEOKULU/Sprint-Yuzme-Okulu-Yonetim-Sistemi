import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import RegistrationCenterFeedback from "./registration-center-feedback";
import "../dashboard.css";
import "./registration-center-professional.css";

export const dynamic = "force-dynamic";

const allowedRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function initials(firstName?: string | null, lastName?: string | null) {
  const first = text(firstName).charAt(0);
  const last = text(lastName).charAt(0);
  return `${first}${last}`.toLocaleUpperCase("tr-TR") || "Ö";
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
    <main data-registration-center>
      <RegistrationCenterFeedback />
      <section data-registration-shell>
        <header className="registrationHero">
          <span className="registrationEyebrow">SPRİNTOS · KAYIT OPERASYONU</span>
          <h1>Kesin Kayıt Merkezi</h1>
          <p>
            Ön kayıttan kesin kayda geçecek kursiyerleri bulun, ödeme-vade ve
            program bilgilerini tamamlayarak kayıt dosyasını açın.
          </p>

          <div className="registrationCountRow">
            <span className="registrationCount">
              Kesin kayıt bekleyen: {allRows.length} öğrenci
            </span>
            {search ? (
              <span className="registrationSearchCount">
                Arama sonucu: {rows.length} öğrenci
              </span>
            ) : null}
          </div>
        </header>

        <nav className="registrationNav" aria-label="Kayıt merkezi bağlantıları">
          <Link data-action-feedback="default" href="/on-kayitlar">
            Ön Kayıt Merkezi
          </Link>
          <Link data-action-feedback="default" href="/ogrenciler">
            Öğrenci Merkezi
          </Link>
        </nav>

        <form method="get" className="registrationSearch">
          <input
            name="q"
            defaultValue={query.q || ""}
            placeholder="Kursiyer, veli, telefon veya öğrenci numarası ara..."
          />
          <button data-action-feedback="default" type="submit">
            Ara
          </button>
        </form>

        {error ? (
          <div className="registrationError">
            Kayıt adayları alınamadı: {error.message}
          </div>
        ) : null}

        <div className="registrationList">
          {rows.map((student: any) => {
            const fullName =
              `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
              "İsimsiz Kursiyer";
            return (
              <article key={student.id} className="registrationStudentCard">
                <div className="registrationAvatar" aria-hidden="true">
                  {initials(student.first_name, student.last_name)}
                </div>

                <div className="registrationStudentMain">
                  <div className="registrationStudentTop">
                    <strong>{fullName}</strong>
                    <span className="registrationBadge">
                      {statusLabels[student.status] || student.status}
                    </span>
                  </div>
                  <div className="registrationMeta">
                    <span>No: {student.student_number || "Henüz yok"}</span>
                    <span>Veli: {student.guardian_name || "—"}</span>
                    <span>Tel: {student.guardian_phone || student.phone || "—"}</span>
                  </div>
                </div>

                <Link
                  data-action-feedback="open-registration"
                  href={`/kayit-tamamlama/${student.id}`}
                  className="registrationOpen"
                >
                  Kesin Kaydı Aç →
                </Link>
              </article>
            );
          })}

          {!rows.length && !error ? (
            <div className="registrationEmpty">
              {search
                ? "Aramanızla eşleşen kesin kayıt adayı bulunamadı."
                : "Kesin kayıt bekleyen kursiyer bulunmuyor."}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
