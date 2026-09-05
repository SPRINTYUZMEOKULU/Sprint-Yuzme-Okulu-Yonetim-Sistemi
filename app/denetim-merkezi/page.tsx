import Link from "next/link";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "./denetim.css";

export const dynamic = "force-dynamic";

type FlatValues = Record<string, unknown>;

const labels: Record<string, string> = {
  "student.first_name": "Ad",
  "student.last_name": "Soyad",
  "student.birth_date": "Doğum tarihi",
  "student.phone": "Öğrenci telefonu",
  "student.email": "Öğrenci e-posta",
  "student.guardian_name": "Veli adı",
  "student.guardian_phone": "Veli telefonu",
  "student.guardian_email": "Veli e-posta",
  "enrollment.package_name": "Paket",
  "enrollment.start_date": "Başlangıç tarihi",
  "enrollment.planned_end_date": "Planlanan bitiş",
  "enrollment.total_lessons": "Toplam ders",
  "enrollment.used_lessons": "Kullanılan ders",
  "enrollment.payment_due_date": "Ödeme vadesi",
  "program.branch_name": "Şube",
  "program.group_name": "Grup",
  "program.selected_weekdays": "Ders günleri",
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function flatten(value: unknown, prefix = "", output: FlatValues = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      flatten(child, prefix ? `${prefix}.${key}` : key, output);
    }
  } else if (prefix) {
    output[prefix] = value;
  }
  return output;
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function labelFor(path: string) {
  if (labels[path]) return labels[path];
  return path
    .split(".")
    .at(-1)!
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("tr-TR"));
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

export default async function AuditCenter({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile(["owner", "admin"]);
  const query = await searchParams;
  const organizationId = profile.organization_id;
  const supabase = await createClient();
  const search = String(query.q || "")
    .trim()
    .toLocaleLowerCase("tr-TR");

  const logsResult = await supabase
    .from("student_activity_logs")
    .select(
      "id,student_id,activity_type,title,description,old_value,new_value,performed_by,performed_at",
    )
    .eq("organization_id", organizationId)
    .order("performed_at", { ascending: false })
    .limit(300);

  const logs = logsResult.data || [];
  const studentIds = Array.from(
    new Set(logs.map((row) => row.student_id).filter(Boolean)),
  );
  const actorIds = Array.from(
    new Set(logs.map((row) => row.performed_by).filter(Boolean)),
  );

  const [studentsResult, actorsResult] = await Promise.all([
    studentIds.length
      ? supabase
          .from("students")
          .select("id,first_name,last_name")
          .in("id", studentIds)
      : Promise.resolve({ data: [] }),
    actorIds.length
      ? supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", actorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const studentNames = new Map(
    (studentsResult.data || []).map((row: any) => [
      row.id,
      `${row.first_name || ""} ${row.last_name || ""}`.trim(),
    ]),
  );
  const actorNames = new Map(
    (actorsResult.data || []).map((row: any) => [
      row.id,
      row.full_name || row.email || "Yönetici",
    ]),
  );
  const visibleLogs = logs.filter((row) => {
    if (!search) return true;
    const haystack =
      `${studentNames.get(row.student_id) || ""} ${row.title || ""} ${row.description || ""} ${actorNames.get(row.performed_by) || ""}`.toLocaleLowerCase(
        "tr-TR",
      );
    return haystack.includes(search);
  });

  return (
    <>
      <UstGezinme />
      <main className="auditPage">
        <section className="auditHero">
          <div>
            <span>SPRİNTOS · OWNER / ADMIN</span>
            <h1>Değişiklik ve Denetim Merkezi</h1>
            <p>
              Öğrenci ve kayıt işlemlerinin önceki ve güncel değerlerini yan
              yana karşılaştırın. Kayıtlar tarih, öğrenci ve işlemi yapan
              yöneticiyle birlikte korunur.
            </p>
          </div>
          <aside>
            <b>{visibleLogs.length}</b>
            <span>görüntülenen kayıt</span>
            <small>Son 300 işlem</small>
          </aside>
        </section>

        <form className="auditTools">
          <label>
            <span>Geçmişte ara</span>
            <input
              name="q"
              defaultValue={query.q || ""}
              placeholder="Öğrenci, işlem veya yönetici adı"
            />
          </label>
          <button type="submit">Kayıtları Filtrele</button>
          {query.q ? (
            <Link href="/denetim-merkezi">Filtreyi Temizle</Link>
          ) : null}
        </form>

        {logsResult.error ? (
          <div className="auditError">
            Denetim kayıtları yüklenemedi: {logsResult.error.message}
          </div>
        ) : null}

        <section className="auditList">
          {visibleLogs.map((row) => {
            const before = flatten(objectValue(row.old_value));
            const after = flatten(objectValue(row.new_value));
            const paths = Array.from(
              new Set([...Object.keys(before), ...Object.keys(after)]),
            );
            const changedPaths = paths.filter(
              (path) => !sameValue(before[path], after[path]),
            );
            return (
              <article className="auditCard" key={row.id}>
                <header>
                  <div>
                    <span>{row.title || "Sistem işlemi"}</span>
                    <h2>
                      {studentNames.get(row.student_id) || "Öğrenci kaydı"}
                    </h2>
                  </div>
                  <time>{formatDate(row.performed_at)}</time>
                </header>
                <div className="auditMeta">
                  <span>
                    <b>İşlemi yapan:</b>{" "}
                    {actorNames.get(row.performed_by) || "Sistem / bilinmiyor"}
                  </span>
                  <span>
                    <b>İşlem türü:</b> {row.activity_type || "—"}
                  </span>
                  {row.student_id ? (
                    <Link href={`/ogrenciler/${row.student_id}`}>
                      Öğrenci dosyasını aç →
                    </Link>
                  ) : null}
                </div>
                {row.description ? (
                  <p className="auditReason">
                    <b>Gerekçe / açıklama:</b> {row.description}
                  </p>
                ) : null}

                {changedPaths.length ? (
                  <div className="comparisonTable">
                    <div className="comparisonHead">
                      <b>Değişen alan</b>
                      <b>Önceki/orijinal bilgi</b>
                      <b>Yeni/güncel bilgi</b>
                    </div>
                    {changedPaths.map((path) => (
                      <div className="comparisonRow" key={path}>
                        <strong>{labelFor(path)}</strong>
                        <span className="beforeValue">
                          {formatValue(before[path])}
                        </span>
                        <span className="afterValue">
                          {formatValue(after[path])}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="noComparison">
                    Bu işlem için karşılaştırmalı eski/yeni veri kaydedilmemiş.
                  </div>
                )}
              </article>
            );
          })}
          {!visibleLogs.length && !logsResult.error ? (
            <div className="auditEmpty">
              Aramanıza uygun denetim kaydı bulunamadı.
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
