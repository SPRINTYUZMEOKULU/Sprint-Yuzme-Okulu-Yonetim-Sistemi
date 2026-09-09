"use client";

import Link from "next/link";

function triggerLegacy(label: string) {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      "[data-attendance-client] nav button"
    )
  );

  const target = buttons.find((button) =>
    button.textContent?.toLocaleLowerCase("tr-TR").includes(label.toLocaleLowerCase("tr-TR"))
  );

  target?.click();
}

function Icon({ name }: { name: "home" | "check" | "calendar" | "history" | "students" }) {
  const common = {
    width: 30,
    height: 30,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>;
  }

  if (name === "check") {
    return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 2.5 2.5L16.5 8.5"/></svg>;
  }

  if (name === "calendar") {
    return <svg {...common}><rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17"/><path d="M8 13h2M14 13h2M8 16.5h2M14 16.5h2"/></svg>;
  }

  if (name === "history") {
    return <svg {...common}><path d="M3.5 12a8.5 8.5 0 1 0 2.4-5.9L3.5 8.5"/><path d="M3.5 4.5v4h4"/><path d="M12 7.5V12l3 2"/></svg>;
  }

  return <svg {...common}><path d="M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M2.5 20c.5-4.1 2.7-6.2 6-6.2s5.5 2.1 6 6.2"/><path d="M17 10a3 3 0 1 0 0-6"/><path d="M16.5 13.8c3 0 4.7 2.1 5 6.2"/></svg>;
}

export default function AttendanceQuickNav() {
  return (
    <nav className="attendanceQuickNav" aria-label="Yoklama hızlı menü">
      <Link href="/" className="attendanceQuickItem">
        <span className="attendanceQuickIcon"><Icon name="home" /></span>
        <span><b>Ana Panel</b><small>Genel Bakış</small></span>
      </Link>

      <button type="button" className="attendanceQuickItem active" onClick={() => triggerLegacy("günlük yoklama")}>
        <span className="attendanceQuickIcon"><Icon name="check" /></span>
        <span><b>Günlük Yoklama</b><small>Bugünkü Dersler</small></span>
      </button>

      <button type="button" className="attendanceQuickItem" onClick={() => triggerLegacy("tüm ayı gör")}>
        <span className="attendanceQuickIcon"><Icon name="calendar" /></span>
        <span><b>Tüm Ayı Gör</b><small>Aylık Takvim</small></span>
      </button>

      <button type="button" className="attendanceQuickItem" onClick={() => triggerLegacy("geçmiş")}>
        <span className="attendanceQuickIcon"><Icon name="history" /></span>
        <span><b>Geçmiş</b><small>Ders Kayıtları</small></span>
      </button>

      <Link href="/ogrenciler" className="attendanceQuickItem attendanceQuickStudents">
        <span className="attendanceQuickIcon"><Icon name="students" /></span>
        <span><b>Öğrenciler</b><small>Kursiyer Listesi</small></span>
      </Link>
    </nav>
  );
}
