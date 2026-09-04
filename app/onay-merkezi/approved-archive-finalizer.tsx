"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type ArchiveItem = {
  id: string;
  student_id: string;
  reason: string | null;
  requested_at: string | null;
  created_at: string | null;
  student: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    status: string | null;
    branch_id: string | null;
  } | null;
};

function studentName(item: ArchiveItem) {
  const name = `${item.student?.first_name || ""} ${item.student?.last_name || ""}`.trim();
  return name || `Öğrenci · ${item.student_id.slice(0, 8)}`;
}

export default function ApprovedArchiveFinalizer() {
  const searchParams = useSearchParams();
  const focusedId = searchParams.get("archiveRequestId") || "";
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student-status-requests/finalize", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.details || data.error || "Onaylı pasif kayıtlar alınamadı.");
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onaylı pasif kayıtlar alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const focused = useMemo(() => items.find((item) => item.id === focusedId) || null, [items, focusedId]);

  async function remove(ids: string[], all = false) {
    const selected = all ? items : items.filter((item) => ids.includes(item.id));
    if (!selected.length) return;

    const names = selected.slice(0, 4).map(studentName).join(", ");
    const extra = selected.length > 4 ? ` ve ${selected.length - 4} öğrenci daha` : "";
    const confirmed = window.confirm(
      `KALICI SİLME ONAYI\n\n${names}${extra}\n\nBu öğrenciler daha önce yönetici tarafından pasife alma için onaylandı. Bu adım öğrenci kaydını ve veritabanındaki öğrenciye bağlı cascade kayıtlarını kalıcı olarak kaldırabilir. Devam etmek istiyor musunuz?`,
    );
    if (!confirmed) return;

    setProcessing(all ? "all" : ids[0]);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/student-status-requests/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all ? { all: true } : { ids }),
      });
      const data = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(data.details || data.error || "Kalıcı silme tamamlanamadı.");
      setMessage(data.message || "Kalıcı silme işlemi tamamlandı.");
      if (Array.isArray(data.failed) && data.failed.length) {
        setError(data.failed.map((row: any) => row.error).join(" · "));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kalıcı silme tamamlanamadı.");
    } finally {
      setProcessing("");
    }
  }

  if (loading) {
    return <section className="archiveFinalizer"><strong>Onaylı pasif kayıtlar kontrol ediliyor…</strong></section>;
  }

  if (!items.length && !message && !error) return null;

  return (
    <section className="archiveFinalizer">
      <div className="archiveHead">
        <div>
          <span>ONAY SONRASI SON ADIM</span>
          <h2>Onaylı Pasifler · Kalıcı Silme</h2>
          <p>Yönetici onayı tamamlanmış pasif öğrencileri tek tek veya toplu olarak sistemden kaldırabilirsiniz.</p>
        </div>
        {items.length ? (
          <button type="button" className="bulkDelete" disabled={processing === "all"} onClick={() => void remove([], true)}>
            {processing === "all" ? "Siliniyor…" : `Onaylı ${items.length} Kaydı Toplu Kalıcı Sil`}
          </button>
        ) : null}
      </div>

      {focusedId && !focused ? (
        <div className="archiveInfo">Bildirimdeki onaylı kayıt artık listede yok. Daha önce kalıcı olarak silinmiş olabilir.</div>
      ) : null}
      {message ? <div className="archiveSuccess">{message}</div> : null}
      {error ? <div className="archiveError">{error}</div> : null}

      <div className="archiveList">
        {items.map((item) => (
          <article key={item.id} className={item.id === focusedId ? "focused" : ""}>
            <div>
              <strong>{studentName(item)}</strong>
              <span>Onaylandı · Pasif</span>
              <small>{item.reason || "Arşivleme / pasife alma onayı"}</small>
            </div>
            <button type="button" disabled={Boolean(processing)} onClick={() => void remove([item.id])}>
              {processing === item.id ? "Kalıcı Siliniyor…" : "Kalıcı Sil"}
            </button>
          </article>
        ))}
      </div>

      <style jsx>{`
        .archiveFinalizer{width:min(1380px,calc(100% - 44px));margin:22px auto 0;padding:20px;border:1px solid #f0c7ce;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,35,65,.06);font-family:Arial,sans-serif}.archiveHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.archiveHead span{font-size:11px;font-weight:900;letter-spacing:.12em;color:#c8103d}.archiveHead h2{margin:6px 0;color:#17345b}.archiveHead p{margin:0;color:#667085;line-height:1.5}.bulkDelete,.archiveList button{border:0;border-radius:11px;background:#c8103d;color:#fff;font-weight:900;padding:12px 15px;cursor:pointer}.bulkDelete:disabled,.archiveList button:disabled{opacity:.55}.archiveList{display:grid;gap:10px;margin-top:16px}.archiveList article{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid #e5eaf1;border-radius:13px;background:#f9fbfd}.archiveList article.focused{border-color:#2f80ed;box-shadow:0 0 0 3px rgba(47,128,237,.1)}.archiveList article>div{display:grid;gap:4px}.archiveList strong{color:#17345b}.archiveList span{color:#17623b;font-size:12px;font-weight:900}.archiveList small{color:#667085}.archiveInfo,.archiveSuccess,.archiveError{margin-top:14px;padding:12px 14px;border-radius:11px;font-weight:800}.archiveInfo{background:#eef5ff;color:#24558b}.archiveSuccess{background:#eefaf4;color:#17623b}.archiveError{background:#fff0f0;color:#a22727}@media(max-width:720px){.archiveFinalizer{width:calc(100% - 24px);padding:15px}.archiveHead,.archiveList article{flex-direction:column;align-items:stretch}.bulkDelete,.archiveList button{width:100%}}
      `}</style>
    </section>
  );
}
