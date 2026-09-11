"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import SessionAttendanceClient from "./session-attendance-client";

type SessionProps = ComponentProps<typeof SessionAttendanceClient>;
type StudentWithStatus = SessionProps["students"][number] & { status?: string | null };

const STORAGE_KEY = "sprint:attendance-show-passive";

export default function AttendanceStudentVisibility(props: SessionProps) {
  const [showPassive, setShowPassive] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setShowPassive(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
    setReady(true);
  }, []);

  function changeVisibility(next: boolean) {
    setShowPassive(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
  }

  const students = useMemo(() => {
    if (showPassive) return props.students;
    return (props.students as StudentWithStatus[]).filter(
      (student) => String(student.status || "active").toLocaleLowerCase("tr-TR") !== "passive",
    );
  }, [props.students, showPassive]);

  const passiveCount = useMemo(
    () =>
      (props.students as StudentWithStatus[]).filter(
        (student) => String(student.status || "").toLocaleLowerCase("tr-TR") === "passive",
      ).length,
    [props.students],
  );

  return (
    <>
      <section className="attendanceVisibility" aria-label="Yoklama öğrenci görünürlüğü">
        <div className="attendanceVisibilityText">
          <span>YOKLAMA GÖRÜNÜMÜ</span>
          <strong>Pasif öğrenciler</strong>
          <small>
            {showPassive
              ? `${passiveCount} pasif öğrenci yoklama listelerinde gösteriliyor.`
              : "Pasife alınan öğrenciler yoklama listesinden otomatik gizlenir."}
          </small>
        </div>
        <button
          type="button"
          className={showPassive ? "isOn" : ""}
          onClick={() => changeVisibility(!showPassive)}
          aria-pressed={showPassive}
          disabled={!ready}
        >
          <span className="switchTrack"><i /></span>
          <span className="switchLabel">{showPassive ? "Pasifleri Göster" : "Pasifleri Gizle"}</span>
        </button>
      </section>

      <SessionAttendanceClient {...props} students={students} />

      <style jsx>{`
        .attendanceVisibility{max-width:1500px;margin:10px auto 12px;padding:12px 14px;border:1px solid #dbe6f2;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 7px 20px rgba(16,40,77,.04);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.attendanceVisibilityText{display:grid;gap:2px}.attendanceVisibilityText span{font-size:9px;letter-spacing:.11em;font-weight:900;color:#2f80ed}.attendanceVisibilityText strong{font-size:14px;color:#123d67}.attendanceVisibilityText small{font-size:10px;color:#7c8da2}.attendanceVisibility button{border:1px solid #d8e3ee;border-radius:12px;background:#f7f9fc;min-height:44px;padding:6px 10px;display:flex;align-items:center;gap:9px;color:#506984;font-weight:900;font-size:11px;cursor:pointer}.attendanceVisibility button.isOn{background:#eef7ff;border-color:#bcd9fb;color:#1269d3}.attendanceVisibility button:disabled{opacity:.6}.switchTrack{width:38px;height:22px;border-radius:999px;background:#cbd5e1;padding:2px;display:flex;align-items:center;transition:.2s}.switchTrack i{width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.2);transition:.2s}.isOn .switchTrack{background:#1769e0}.isOn .switchTrack i{transform:translateX(16px)}@media(max-width:620px){.attendanceVisibility{margin:8px 10px 10px;padding:11px 12px}.attendanceVisibilityText small{max-width:220px}.switchLabel{display:none}.attendanceVisibility button{min-width:58px;justify-content:center}}
      `}</style>
    </>
  );
}
