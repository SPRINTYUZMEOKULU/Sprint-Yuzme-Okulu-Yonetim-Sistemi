"use client";

export default function ReportsError({ reset }: { reset: () => void }) {
  return <main className="reportsShell">
    <div className="reportsError" role="alert">
      <strong>Rapor yüklenemedi.</strong>
      <span>Seçtiğiniz filtrelerle yeniden deneyebilirsiniz.</span>
      <button type="button" className="reportSecondary" onClick={reset}>Yeniden dene</button>
    </div>
  </main>;
}
