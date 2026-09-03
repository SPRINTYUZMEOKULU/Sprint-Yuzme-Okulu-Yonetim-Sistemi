import Link from "next/link";
import { redirect } from "next/navigation";

import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function fmt(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const STATUS: Record<string, string> = {
  pending: "Yönetici Onayı Bekliyor",
  approved: "Onaylandı · Tamamlanmayı Bekliyor",
  rejected: "Reddedildi",
};

export default async function RenewalOperationsPage() {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
  ]);

  if (!profile.organization_id) redirect("/");

  const supabase = await createClient();

  const [activityResult, approvalResult] = await Promise.all([
    supabase
      .from("student_activity_logs")
      .select("id,student_id,title,description,new_value,performed_at,performed_by")
      .eq("organization_id", profile.organization_id)
      .eq("activity_type", "registration_renewed")
      .order("performed_at", { ascending: false })
      .limit(150),
    supabase
      .from("approval_requests")
      .select("id,student_id,status,reason,new_values,metadata,requested_at,created_at,reviewed_at,requested_by,reviewed_by_name")
      .eq("organization_id", profile.organization_id)
      .eq("request_type", "registration_custom_lesson_count")
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const completed = activityResult.data || [];
  const renewalApprovals = (approvalResult.data || []).filter((row: any) => {
    const metadata = asObject(row.metadata);
    return metadata.source === "student_renewal_center";
  });

  const actionRequired = renewalApprovals.filter((row: any) => {
    const metadata = asObject(row.metadata);
    return row.status === "pending" || (row.status === "approved" && !metadata.consumed_at);
  });

  const studentIds = Array.from(
    new Set(
      [...completed, ...renewalApprovals]
        .map((row: any) => row.student_id)
        .filter(Boolean),
    ),
  ) as string[];

  const { data: students } = studentIds.length
    ? await supabase
        .from("students")
        .select("id,first_name,last_name,status")
        .eq("organization_id", profile.organization_id)
        .in("id", studentIds)
    : { data: [] as any[] };

  const studentMap = new Map((students || []).map((item: any) => [item.id, item]));

  const pendingCount = actionRequired.filter((row: any) => row.status === "pending").length;
  const readyCount = actionRequired.filter((row: any) => row.status === "approved").length;

  return (
    <>
      <UstGezinme />
      <main className="renewalsPage">
        <section className="renewalsHero">
          <div>
            <p>SPRİNTOS · KAYIT OPERASYONU</p>
            <h1>Kayıt Yenilemeleri</h1>
            <span>
              Yenilenen kayıtları, yönetici onayı bekleyen özel ders sayılarını ve onay sonrası tamamlanmayı bekleyen işlemleri tek merkezden izleyin.
            </span>
          </div>
          <div className="heroActions">
            <Link href="/ogrenciler">Öğrencilere Git</Link>
            <Link href="/onay-merkezi" className="primary">Onay Merkezi</Link>
          </div>
        </section>

        <section className="statGrid" aria-label="Kayıt yenileme özeti">
          <article><span>Tamamlanan Yenileme</span><strong>{completed.length}</strong></article>
          <article><span>Onay Bekleyen</span><strong>{pendingCount}</strong></article>
          <article><span>Onaylandı · Tamamlanacak</span><strong>{readyCount}</strong></article>
          <article><span>Toplam Açık İşlem</span><strong>{actionRequired.length}</strong></article>
        </section>

        <section className="renewalPanel important">
          <div className="sectionHead">
            <div>
              <p>İŞLEM BEKLEYENLER</p>
              <h2>Yönetici onayı ve tamamlanacak yenilemeler</h2>
            </div>
            <strong>{actionRequired.length} açık işlem</strong>
          </div>

          <div className="cards">
            {actionRequired.map((row: any) => {
              const student = studentMap.get(row.student_id);
              const next = asObject(row.new_values);
              const metadata = asObject(row.metadata);
              const lessonCount = Number(next.total_lessons || 0);
              const isReady = row.status === "approved" && !metadata.consumed_at;
              return (
                <article className="actionCard" key={row.id}>
                  <div className="actionMain">
                    <span className={`state ${row.status}`}>{STATUS[row.status] || row.status}</span>
                    <h3>{student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() : "Öğrenci"}</h3>
                    <p>{lessonCount ? `${lessonCount} derslik özel kayıt yenileme` : row.reason || "Kayıt yenileme talebi"}</p>
                    <small>Talep: {fmt(row.requested_at || row.created_at)}{row.reviewed_at ? ` · Onay: ${fmt(row.reviewed_at)}` : ""}</small>
                  </div>
                  <div className="actionButtons">
                    {row.status === "pending" ? (
                      <Link href="/onay-merkezi" className="approvalButton">Onay Merkezine Git</Link>
                    ) : null}
                    {isReady && row.student_id ? (
                      <Link
                        href={`/ogrenciler/${row.student_id}?renewalApproval=approved&renewalRequestId=${row.id}`}
                        className="completeButton"
                        data-complete-renewal="1"
                      >
                        Yenilemeyi Tamamla
                      </Link>
                    ) : null}
                    {row.student_id ? <Link href={`/ogrenciler/${row.student_id}`}>Öğrenci Dosyası</Link> : null}
                  </div>
                </article>
              );
            })}
            {!actionRequired.length ? (
              <div className="emptyState">✓ Şu anda onay veya tamamlama bekleyen kayıt yenilemesi yok.</div>
            ) : null}
          </div>
        </section>

        <section className="renewalPanel">
          <div className="sectionHead">
            <div>
              <p>YENİLEME GEÇMİŞİ</p>
              <h2>Tamamlanan kayıt yenilemeleri</h2>
            </div>
            <strong>Son {completed.length} kayıt</strong>
          </div>

          <div className="historyTableWrap">
            <table>
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th>Ders</th>
                  <th>Yenileme Tarihi</th>
                  <th>Açıklama</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((row: any) => {
                  const student = studentMap.get(row.student_id);
                  const next = asObject(row.new_value);
                  return (
                    <tr key={row.id}>
                      <td><strong>{student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() : "Öğrenci"}</strong></td>
                      <td>{next.lesson_count ? `${next.lesson_count} ders` : "—"}</td>
                      <td>{fmt(row.performed_at)}</td>
                      <td>{row.description || row.title || "Kayıt yenilendi"}</td>
                      <td>{row.student_id ? <Link href={`/ogrenciler/${row.student_id}`}>Dosyayı Aç →</Link> : "—"}</td>
                    </tr>
                  );
                })}
                {!completed.length ? (
                  <tr><td colSpan={5} className="emptyCell">Henüz tamamlanmış kayıt yenilemesi bulunmuyor.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <script dangerouslySetInnerHTML={{__html:`document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-complete-renewal="1"]');if(!a)return;a.style.pointerEvents='none';a.style.opacity='.72';a.textContent='Yenileme hazırlanıyor…';},true);`}} />

      <style>{`
        .renewalsPage{min-height:100vh;padding:28px;background:linear-gradient(180deg,#f4f7fb,#edf3f9);color:#10213a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .renewalsHero{max-width:1500px;margin:0 auto 18px;padding:26px 28px;display:flex;align-items:center;justify-content:space-between;gap:22px;border-radius:24px;background:linear-gradient(135deg,#071f3f,#0b5d9f);color:#fff;box-shadow:0 20px 55px rgba(12,45,80,.18)}
        .renewalsHero p,.sectionHead p{margin:0 0 6px;color:#ff9b1a;font-size:11px;font-weight:950;letter-spacing:.13em}.renewalsHero h1{margin:0 0 7px;font-size:31px}.renewalsHero span{display:block;max-width:850px;color:#d8e7f7;font-size:13px;line-height:1.55}
        .heroActions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}.heroActions a,.actionButtons a{min-height:42px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.24);border-radius:12px;color:#fff;text-decoration:none;font-size:12px;font-weight:900;touch-action:manipulation}.heroActions a.primary{background:#fff;color:#0b4f89;border-color:#fff}
        .statGrid{max-width:1500px;margin:0 auto 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.statGrid article{padding:17px 18px;border:1px solid #dce6f0;border-radius:17px;background:#fff;box-shadow:0 10px 28px rgba(20,45,75,.06)}.statGrid span{display:block;color:#718298;font-size:10px;font-weight:900;text-transform:uppercase}.statGrid strong{display:block;margin-top:5px;color:#0b477c;font-size:25px}
        .renewalPanel{max-width:1500px;margin:0 auto 18px;padding:22px;border:1px solid #dce6f0;border-radius:21px;background:#fff;box-shadow:0 12px 34px rgba(20,45,75,.07)}.renewalPanel.important{border-color:#ead9ad}.sectionHead{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:15px}.sectionHead h2{margin:0;color:#123b62;font-size:21px}.sectionHead>strong{padding:8px 11px;border-radius:999px;background:#eef5ff;color:#15568f;font-size:11px}
        .cards{display:grid;gap:10px}.actionCard{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px;border:1px solid #e1e8f0;border-radius:15px;background:#fbfdff}.actionMain{min-width:0}.actionMain h3{margin:7px 0 3px;color:#103b65;font-size:16px}.actionMain p{margin:0 0 5px;color:#546b82;font-size:12px}.actionMain small{color:#8493a5;font-size:10px}.state{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900}.state.pending{background:#fff4d8;color:#8a5a00}.state.approved{background:#dcfce7;color:#166534}.actionButtons{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.actionButtons a{min-height:38px;border-color:#d6e2ef;color:#345a7e;background:#fff}.actionButtons .approvalButton{background:#fff5dd;color:#7f570d;border-color:#efd18d}.actionButtons .completeButton{background:#0b65aa;color:#fff;border-color:#0b65aa}
        .emptyState,.emptyCell{padding:22px;text-align:center;color:#55718a;background:#f7fafc;border-radius:13px;font-weight:800}.historyTableWrap{overflow-x:auto}.historyTableWrap table{width:100%;border-collapse:collapse;min-width:800px}.historyTableWrap th,.historyTableWrap td{padding:12px 10px;border-bottom:1px solid #e5edf4;text-align:left;font-size:12px}.historyTableWrap th{color:#708195;font-size:10px;text-transform:uppercase}.historyTableWrap td{color:#435d76}.historyTableWrap td strong{color:#123d67}.historyTableWrap a{color:#0b65aa;text-decoration:none;font-weight:900}
        @media(max-width:900px){.renewalsPage{padding:14px}.renewalsHero{align-items:flex-start;flex-direction:column;padding:21px}.heroActions{width:100%;justify-content:flex-start}.statGrid{grid-template-columns:repeat(2,1fr)}.actionCard{align-items:flex-start;flex-direction:column}.actionButtons{width:100%;justify-content:flex-start}.actionButtons a{min-height:46px}.renewalPanel{padding:16px}.sectionHead{align-items:flex-start;flex-direction:column}}
        @media(max-width:520px){.renewalsHero h1{font-size:25px}.statGrid{grid-template-columns:1fr 1fr;gap:8px}.statGrid article{padding:13px}.statGrid strong{font-size:21px}.heroActions a{min-height:46px}.actionButtons a{width:100%}}
      `}</style>
    </>
  );
}
