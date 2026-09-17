"use client";

import { useState } from "react";

export type FacilityOption = { id: string; name: string };
export type GroupOption = { id: string; branch_id: string; name: string };

export default function TesisSezonYonetimi({ branches, groups }: { branches: FacilityOption[]; groups: GroupOption[] }) {
  const [mode, setMode] = useState<"close" | "start" | "transfer">("close");

  return (
    <section className="facilityOps">
      <div className="facilityOpsHead">
        <div><span>TESİS & SEZON YÖNETİMİ</span><h2>Havuz kapanışlarını ve yeniden başlangıçları tek yerden yönetin</h2><p>Kapanış süresince ders hakları korunur. START veya Aktar + START işleminde kalan dersler yeni gerçek ders takvimine göre yeniden planlanır.</p></div>
        <div className="facilityStatus">DERS HAKKI KORUMALI</div>
      </div>
      <div className="facilityModes">
        <button type="button" className={mode === "close" ? "active danger" : ""} onClick={() => setMode("close")}>● Tesis / Sezonu Kapat</button>
        <button type="button" className={mode === "start" ? "active start" : ""} onClick={() => setMode("start")}>▶ START Ver</button>
        <button type="button" className={mode === "transfer" ? "active transfer" : ""} onClick={() => setMode("transfer")}>↗ Aktar + START Ver</button>
      </div>
      <form action="/tesis-sezon-yonetimi" method="get" className="facilityForm">
        <input type="hidden" name="islem" value={mode} />
        <label>{mode === "transfer" ? "Kaynak havuz / şube" : "Havuz / şube"}<select name="sube" required defaultValue=""><option value="" disabled>Seçiniz</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        {mode === "close" && <><label>Kapanış tarihi<input type="date" name="kapanis" required /></label><label>Tahmini açılış tarihi <small>(opsiyonel)</small><input type="date" name="tahmini_acilis" /></label></>}
        {mode === "start" && <label>Gerçek START tarihi<input type="date" name="start" required /></label>}
        {mode === "transfer" && <><label>Hedef havuz / şube<select name="hedef_sube" required defaultValue=""><option value="" disabled>Seçiniz</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Yeni başlangıç / START tarihi<input type="date" name="start" required /></label></>}
        <button className="facilityPrimary" type="submit">{mode === "close" ? "Kapanışı Planla" : mode === "start" ? "START İşlemini Aç" : "Aktarım + START İşlemini Aç"}</button>
      </form>
      <div className="facilityInfo"><strong>Otomatik koruma:</strong> Kapanış tarihinden sonraki planlı dersler öğrencinin hakkından düşmez; yoklama tüketimi oluşmaz. Yeniden başlangıçta kalan hak, öğrencinin yeni grubunun gerçek ders günlerine göre ileriye planlanır. Aktarım seçeneği kapanış → aktarım → başlangıç akışını tek işlemde yürütür.</div>
      <style jsx>{`
        .facilityOps{margin:18px 0 24px;border:1px solid #d8e6f7;border-radius:22px;background:#fff;box-shadow:0 14px 35px rgba(16,48,88,.08);overflow:hidden}.facilityOpsHead{display:flex;justify-content:space-between;gap:18px;padding:22px;background:linear-gradient(135deg,#082a58,#0d6bca);color:#fff}.facilityOpsHead span{font-size:10px;font-weight:950;letter-spacing:.13em;color:#91c9ff}.facilityOpsHead h2{font-size:20px;margin:6px 0}.facilityOpsHead p{max-width:720px;margin:0;color:#dcecff;font-size:12px;line-height:1.55}.facilityStatus{align-self:flex-start;white-space:nowrap;padding:8px 10px;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:rgba(255,255,255,.12);font-size:10px;font-weight:900}.facilityModes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px 18px 0}.facilityModes button{min-height:45px;border:1px solid #d9e3ef;border-radius:12px;background:#f8fafd;color:#344765;font-weight:900;cursor:pointer}.facilityModes .active{border-color:#1769e8;background:#edf5ff;color:#1769e8;box-shadow:0 0 0 3px rgba(23,105,232,.08)}.facilityModes .active.danger{border-color:#dc5b62;background:#fff4f4;color:#b72f39}.facilityModes .active.start{border-color:#29976a;background:#f0fbf6;color:#19744e}.facilityForm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:18px}.facilityForm label{font-size:12px;font-weight:850;color:#42536f}.facilityForm small{font-weight:600;color:#7b8798}.facilityForm select,.facilityForm input{display:block;width:100%;box-sizing:border-box;margin-top:7px;min-height:46px;padding:10px 12px;border:1px solid #d8e2ef;border-radius:12px;background:#fbfcff;color:#13233f;font:inherit}.facilityPrimary{align-self:end;min-height:46px;border:0;border-radius:12px;background:#1769e8;color:#fff;font-weight:900;cursor:pointer}.facilityInfo{margin:0 18px 18px;padding:13px 14px;border:1px solid #d6e7fd;border-radius:13px;background:#f2f7ff;color:#53647d;font-size:12px;line-height:1.55}.facilityInfo strong{color:#17375f}@media(max-width:720px){.facilityOpsHead{flex-direction:column}.facilityStatus{align-self:flex-start}.facilityModes,.facilityForm{grid-template-columns:1fr}.facilityModes{gap:8px}.facilityOpsHead h2{font-size:18px}}
      `}</style>
    </section>
  );
}
