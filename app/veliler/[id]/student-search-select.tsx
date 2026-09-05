"use client";

import { useMemo, useState } from "react";

type StudentOption = { id: string; name: string; number: string };

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export default function StudentSearchSelect({ students }: { students: StudentOption[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StudentOption | null>(null);
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const needle = normalize(query);
    return (needle
      ? students.filter((student) => normalize(`${student.name} ${student.number}`).includes(needle))
      : students
    ).slice(0, 12);
  }, [query, students]);

  function choose(student: StudentOption) {
    setSelected(student);
    setQuery(student.name);
    setOpen(false);
  }

  return (
    <div className="studentSearch">
      <input type="hidden" name="student_id" value={selected?.id || ""} />
      <label htmlFor="guardian-student-search">Yeni öğrenci bağla</label>
      <div className={`studentSearchBox ${open ? "open" : ""}`}>
        <span aria-hidden="true">⌕</span>
        <input
          id="guardian-student-search"
          type="search"
          value={query}
          placeholder="Ad soyad veya öğrenci numarası yazın"
          autoComplete="off"
          aria-expanded={open}
          aria-controls="guardian-student-results"
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setSelected(null); setOpen(true); }}
        />
        {query ? <button type="button" aria-label="Aramayı temizle" onClick={() => { setQuery(""); setSelected(null); setOpen(true); }}>×</button> : null}
      </div>
      {open ? (
        <div className="studentSearchResults" id="guardian-student-results" role="listbox">
          {results.map((student) => (
            <button type="button" role="option" aria-selected={selected?.id === student.id} key={student.id} onClick={() => choose(student)}>
              <span>{student.name}</span><small>{student.number || "Öğrenci numarası yok"}</small>
            </button>
          ))}
          {!results.length ? <p>Bu aramayla eşleşen öğrenci bulunamadı.</p> : null}
          {!query && students.length > 12 ? <small className="studentSearchHint">İsim yazarak {students.length} öğrenci içinde arayabilirsiniz.</small> : null}
        </div>
      ) : null}
      {selected ? <div className="studentSearchSelected"><span>Seçilen öğrenci</span><strong>{selected.name}</strong><small>{selected.number}</small></div> : <small className="studentSearchHelp">Bağlantı kurmak için listeden bir öğrenci seçiniz.</small>}
    </div>
  );
}
