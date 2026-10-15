"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSwimmingLevel } from "./actions";

export type ManagedLevel = { id: string; name: string; description: string | null; sort_order: number; is_active: boolean; students: number; groups: number; memberships: number };
function LevelEditor({ level }: { level?: ManagedLevel }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();
  const inUse = !!level && level.students + level.groups + level.memberships > 0;
  return <form className="levelEditor" onSubmit={async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setResult(null);
    try { const response = await saveSwimmingLevel(data); setResult(response); if (response.ok) { if (!level) form.reset(); router.refresh(); } }
    catch { setResult({ ok: false, message: "Bağlantı kurulamadı. Yeniden deneyin." }); }
    finally { setBusy(false); }
  }}>
    <input type="hidden" name="id" value={level?.id || ""} />
    <div className="levelEditorTop"><label>Seviye adı<input name="name" required maxLength={100} readOnly={inUse} defaultValue={level?.name || ""} placeholder="Örn. Başlangıç" /></label>
    <label>Görünüm sırası<input name="sort_order" type="number" required min={0} max={999} defaultValue={level?.sort_order ?? 10} /></label></div>
    {inUse ? <small>Bu seviye kayıtlarda kullanılıyor. Bağlantıları korumak için adı sabittir.</small> : null}
    <label>Beceri açıklaması<textarea name="description" maxLength={1500} rows={3} defaultValue={level?.description || ""} placeholder="Bu seviyedeki yüzücünün becerileri ve eğitim hedefleri" /></label>
    <div className="levelEditorFooter"><label className="levelActive"><input name="is_active" type="checkbox" defaultChecked={level?.is_active ?? true} /> Yeni seçimlere açık</label><button disabled={busy}>{busy ? "Kaydediliyor…" : level ? "Değişiklikleri kaydet" : "Seviye ekle"}</button></div>
    {result ? <p role="status" className={result.ok ? "levelSuccess" : "levelError"}>{result.message}</p> : null}
  </form>;
}
export default function LevelManager({ levels }: { levels: ManagedLevel[] }) {
  const [showInactive, setShowInactive] = useState(false);
  const [query, setQuery] = useState("");
  const visible = levels.filter((l) => (showInactive || l.is_active) && l.name.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  return <><section className="levelPanel"><div className="levelToolbar"><label>Seviye ara<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Seviye adı…" /></label><label className="levelActive"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Pasifleri de göster</label></div></section>
    <div className="levelList">{visible.map((level) => <details key={`${level.id}-${level.name}-${level.description}-${level.sort_order}-${level.is_active}`} className="levelPanel">
      <summary><span className="levelNumber">{level.sort_order}</span><span className="levelSummary"><b>{level.name}</b><small>{level.description || "Beceri açıklaması eklenmemiş"}</small></span><span className={level.is_active ? "levelBadge" : "levelBadge inactive"}>{level.is_active ? "Aktif" : "Pasif"}</span><span className="levelExpand">Düzenle</span></summary>
      <p className="levelUsage">{level.students} kursiyer · {level.groups} grup · {level.memberships} grup üyeliği</p><LevelEditor level={level} />
    </details>)}</div>
    {!visible.length ? <p className="levelPanel">Bu filtrede seviye bulunamadı.</p> : null}
    <details className="levelPanel levelNew"><summary><b>+ Yeni seviye ekle</b></summary><LevelEditor /></details>
  </>;
}
