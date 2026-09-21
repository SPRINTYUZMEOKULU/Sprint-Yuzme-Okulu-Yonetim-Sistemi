"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type OperationStudentRow = {
  id: string;
  name: string;
  student_number?: string | null;
  age?: number | null;
  level?: string | null;
  group_id?: string | null;
  group_name?: string | null;
  branch_name?: string | null;
  coach_id?: string | null;
  coach_name?: string | null;
  schedule_text?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  phone?: string | null;
};

type Coach = { id: string; full_name?: string | null; email?: string | null };

export default function OperationStudentManager({
  students,
  coaches,
  levels,
}: {
  students: OperationStudentRow[];
  coaches: Coach[];
  levels: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [coachId, setCoachId] = useState("");
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const groups = useMemo(
    () => Array.from(new Set(students.map((student) => student.group_name).filter(Boolean) as string[])).sort(),
    [students],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return students.filter((student) => {
      if (groupFilter && student.group_name !== groupFilter) return false;
      if (coachFilter && student.coach_id !== coachFilter) return false;
      if (!q) return true;
      return [
        student.name,
        student.student_number,
        student.group_name,
        student.branch_name,
        student.coach_name,
        student.level,
        student.guardian_name,
        student.guardian_phone,
        student.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(q);
    });
  }, [students, search, groupFilter, coachFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((student) => selected.includes(student.id));

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected((current) => current.filter((id) => !filtered.some((student) => student.id === id)));
    } else {
      setSelected((current) => Array.from(new Set([...current, ...filtered.map((student) => student.id)])));
    }
  }

  async function apply(action: "coach" | "level", ids = selected, value?: string) {
    if (!ids.length || busy) return;
    const chosenCoach = action === "coach" ? value || coachId : "";
    const chosenLevel = action === "level" ? value || level : "";
    if (action === "coach" && !chosenCoach) {
      setMessage("Eğitmen seçin.");
      return;
    }
    if (action === "level" && !chosenLevel) {
      setMessage("Seviye seçin.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/operation-student-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          student_ids: ids,
          coach_id: chosenCoach || null,
          level: chosenLevel || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
      setMessage(`${result.updated || ids.length} kursiyer güncellendi.`);
      setSelected([]);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="operationRoster">
      <div className="operationRosterHeader">
        <div>
          <span>AKTİF KURSİYER YÖNETİMİ</span>
          <h2>Tüm Kursiyerler · Kalıcı Eğitim Planı</h2>
          <p>Grup, seviye, sorumlu eğitmen ve haftalık ders programını tek ekranda yönetin. Günlük katılım için Yoklama kullanılır.</p>
        </div>
        <div className="rosterHeaderStats">
          <b>{students.length}</b>
          <small>aktif kursiyer</small>
        </div>
      </div>

      <div className="rosterFilters">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Öğrenci, veli, telefon, grup veya eğitmen ara"
        />
        <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
          <option value="">Tüm Gruplar</option>
          {groups.map((group) => <option key={group} value={group}>{group}</option>)}
        </select>
        <select value={coachFilter} onChange={(event) => setCoachFilter(event.target.value)}>
          <option value="">Tüm Eğitmenler</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>{coach.full_name || coach.email || "Eğitmen"}</option>
          ))}
        </select>
      </div>

      <div className="bulkBar">
        <label className="selectAll">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
          <span>{selected.length ? `${selected.length} seçili` : "Görünenlerin tümünü seç"}</span>
        </label>

        <div className="bulkControl">
          <select value={coachId} onChange={(event) => setCoachId(event.target.value)}>
            <option value="">Toplu eğitmen seç</option>
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>{coach.full_name || coach.email || "Eğitmen"}</option>
            ))}
          </select>
          <button disabled={busy || !selected.length || !coachId} onClick={() => void apply("coach")}>Eğitmeni Ata</button>
        </div>

        <div className="bulkControl">
          <select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="">Toplu seviye seç</option>
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button disabled={busy || !selected.length || !level} onClick={() => void apply("level")}>Seviyeyi Ata</button>
        </div>
      </div>

      {message && <div className="rosterMessage">{message}</div>}

      <div className="rosterGrid">
        {filtered.map((student) => {
          const checked = selected.includes(student.id);
          return (
            <article key={student.id} className={`rosterCard ${checked ? "selected" : ""}`}>
              <div className="rosterCardTop">
                <label className="studentCheck">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelected((current) =>
                        checked ? current.filter((id) => id !== student.id) : [...current, student.id],
                      )
                    }
                  />
                </label>
                <div className="rosterIdentity">
                  <strong>{student.name}</strong>
                  <span>
                    {student.student_number || "Öğrenci No Yok"} · {student.age === null || student.age === undefined ? "Yaş bilgisi yok" : `${student.age} yaş`}
                  </span>
                </div>
                <span className="levelPill">{student.level || "Seviye Yok"}</span>
              </div>

              <div className="rosterFacts">
                <div><span>Grup</span><b>{student.group_name || "Grup Yok"}</b></div>
                <div><span>Şube</span><b>{student.branch_name || "Şube Yok"}</b></div>
                <div><span>Sorumlu Eğitmen</span><b>{student.coach_name || "Atanmadı"}</b></div>
                <div><span>Haftalık Program</span><b className="scheduleValue">{student.schedule_text || "Program Yok"}</b></div>
              </div>

              <div className="guardianLine">
                <span>Veli / İletişim</span>
                <b>{student.guardian_name || "—"} · {student.guardian_phone || student.phone || "Telefon Yok"}</b>
              </div>

              <div className="inlineAssignments">
                <select
                  defaultValue={student.coach_id || ""}
                  onChange={(event) => {
                    if (event.target.value) void apply("coach", [student.id], event.target.value);
                  }}
                  disabled={busy}
                >
                  <option value="">Eğitmen Ata</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coach.full_name || coach.email || "Eğitmen"}</option>
                  ))}
                </select>

                <select
                  defaultValue={student.level || ""}
                  onChange={(event) => {
                    if (event.target.value) void apply("level", [student.id], event.target.value);
                  }}
                  disabled={busy}
                >
                  <option value="">Seviye Ata</option>
                  {levels.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>

              <div className="rosterActions">
                <Link href={`/ogrenciler/${student.id}`}>Dijital Dosya</Link>
                <Link href={`/yoklama?grup=${student.group_id || ""}`}>Yoklamaya Git</Link>
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && <div className="rosterEmpty">Bu filtrelerde kursiyer bulunamadı.</div>}

      <style jsx>{`
        .operationRoster{background:#fff;border:1px solid #d9e4f2;border-radius:20px;padding:16px;margin-bottom:18px;box-shadow:0 8px 28px rgba(31,76,135,.06)}
        .operationRosterHeader{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:14px}
        .operationRosterHeader>div:first-child>span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#1769e8}
        .operationRosterHeader h2{margin:4px 0 5px;font-size:20px;color:#13233f}
        .operationRosterHeader p{margin:0;max-width:820px;color:#65758d;font-size:12px;line-height:1.5}
        .rosterHeaderStats{min-width:94px;text-align:center;border:1px solid #d7e5f6;border-radius:14px;padding:10px;background:#f7fbff}
        .rosterHeaderStats b{display:block;font-size:23px;color:#1769e8}.rosterHeaderStats small{color:#718096;font-weight:700}
        .rosterFilters{display:grid;grid-template-columns:minmax(240px,1.7fr) repeat(2,minmax(150px,.7fr));gap:8px;margin-bottom:10px}
        .rosterFilters input,.rosterFilters select,.bulkControl select,.inlineAssignments select{width:100%;min-height:42px;border:1px solid #d4e0ee;border-radius:11px;background:#fff;color:#17345c;padding:0 11px;font-size:12px;box-sizing:border-box}
        .bulkBar{display:grid;grid-template-columns:minmax(180px,.8fr) repeat(2,minmax(250px,1fr));gap:8px;align-items:center;padding:10px;border:1px solid #dce8f6;border-radius:14px;background:#f7fbff;margin-bottom:12px}
        .selectAll{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#29496e}
        .selectAll input,.studentCheck input{width:18px;height:18px;accent-color:#1769e8}
        .bulkControl{display:grid;grid-template-columns:1fr auto;gap:7px}
        .bulkControl button{border:0;border-radius:10px;background:#1769e8;color:#fff;padding:0 12px;font-weight:850;font-size:11px;cursor:pointer}
        .bulkControl button:disabled{opacity:.45;cursor:not-allowed}
        .rosterMessage{padding:9px 11px;margin-bottom:10px;border-radius:10px;background:#eef6ff;color:#1459a6;font-size:12px;font-weight:800}
        .rosterGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .rosterCard{border:1px solid #dce6f2;border-radius:16px;padding:13px;background:#fff;transition:.15s ease}
        .rosterCard.selected{border-color:#1769e8;box-shadow:0 0 0 2px rgba(23,105,232,.1)}
        .rosterCardTop{display:flex;align-items:flex-start;gap:9px}.studentCheck{padding-top:2px}
        .rosterIdentity{display:grid;gap:3px;min-width:0;flex:1}.rosterIdentity strong{font-size:15px;color:#13233f}.rosterIdentity span{font-size:10px;color:#8a9ab0}
        .levelPill{font-size:10px;font-weight:850;color:#1769e8;background:#edf5ff;border:1px solid #cfe1fb;border-radius:9px;padding:6px 8px;white-space:nowrap}
        .rosterFacts{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
        .rosterFacts>div,.guardianLine{border:1px solid #e4ebf3;border-radius:10px;padding:8px 9px;background:#fbfdff;min-width:0}
        .rosterFacts span,.guardianLine span{display:block;font-size:9px;color:#8796aa;margin-bottom:3px;text-transform:uppercase;font-weight:800;letter-spacing:.04em}
        .rosterFacts b,.guardianLine b{display:block;color:#263c59;font-size:11px;line-height:1.35;white-space:normal}
        .scheduleValue{white-space:pre-line!important}.guardianLine{margin-top:7px}
        .inlineAssignments{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
        .rosterActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
        .rosterActions a{display:flex;align-items:center;justify-content:center;min-height:38px;border:1px solid #cfe0f4;border-radius:10px;text-decoration:none;color:#1769e8;font-size:11px;font-weight:850}
        .rosterActions a:last-child{background:#1769e8;color:#fff;border-color:#1769e8}
        .rosterEmpty{padding:28px;text-align:center;color:#7b8ca2}
        @media(max-width:900px){.rosterGrid{grid-template-columns:1fr}.bulkBar{grid-template-columns:1fr}.rosterFilters{grid-template-columns:1fr}}
        @media(max-width:560px){.operationRoster{padding:11px;border-radius:16px}.operationRosterHeader{align-items:stretch}.rosterHeaderStats{min-width:76px}.operationRosterHeader h2{font-size:17px}.rosterFacts{grid-template-columns:1fr 1fr}.inlineAssignments,.rosterActions{grid-template-columns:1fr 1fr}.bulkControl{grid-template-columns:1fr auto}.bulkControl button{padding:0 9px}.levelPill{max-width:120px;overflow:hidden;text-overflow:ellipsis}.rosterCard{padding:11px}}
      `}</style>
    </section>
  );
}
