"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./lesson-balance.css";

export default function LessonBalance({ normal, makeup, ready, alertKey, attendanceUrl, requestUrl }: {
  normal: number;
  makeup: number;
  ready: boolean;
  alertKey?: string;
  attendanceUrl: string;
  requestUrl: string;
}) {
  const total = normal + makeup;
  const tone = !ready ? "unknown" : normal <= 1 ? "critical" : normal === 2 ? "warning" : "standard";
  const message = !ready ? "Ders hakları şu anda doğrulanamadı."
    : total === 0 ? "Kalan ders hakkınız bitti."
    : normal === 0 ? `Normal ders hakkınız bitti. ${makeup} telafi hakkınız var.`
    : normal <= 2 ? `Son ${normal} normal dersiniz kaldı.` : "";
  const noticeKey = alertKey && ready && message ? `guardian-lessons:${alertKey}:${normal}:${total === 0 ? "empty" : "remaining"}` : "";
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!noticeKey) return;
    try {
      if (localStorage.getItem(noticeKey)) return;
      localStorage.setItem(noticeKey, "shown");
    } catch { /* The balance card still displays the current warning. */ }
    setNotice(noticeKey);
  }, [noticeKey]);

  return <section className="guardianLessonCard" data-tone={tone} aria-labelledby="lesson-balance-heading">
    <div className="guardianLessonCardHeader">
      <div><h2 id="lesson-balance-heading">Kalan ders hakları</h2><Link href={attendanceUrl}>Ders takvimini gör</Link></div>
      <div className="guardianLessonTotal"><span>Toplam</span><strong>{ready ? total : "—"}</strong></div>
    </div>
    <dl className="guardianLessonCounters">
      <div><dt>Normal ders</dt><dd>{ready ? normal : "—"}</dd></div>
      <div><dt>Telafi dersi</dt><dd>{ready ? makeup : "—"}</dd></div>
    </dl>
    {message && <div className="guardianLessonWarning" role="status">
      <strong>{message}</strong>
      {ready && <Link href={requestUrl}>{total === 0 ? "Kayıt yenileme için yönetime yaz" : "Yönetime yaz"}</Link>}
    </div>}
    {noticeKey && notice === noticeKey && <aside className="guardianLessonToast" role="status">
      <strong>{message}</strong>
      <button type="button" onClick={() => setNotice("")}>Kapat</button>
    </aside>}
  </section>;
}
