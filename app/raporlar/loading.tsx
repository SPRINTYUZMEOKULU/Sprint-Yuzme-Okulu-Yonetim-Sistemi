export default function ReportsLoading() {
  return <main className="reportsShell">
    <div className="reportsWrap" role="status" aria-busy="true">
      <header className="reportsHeader">
        <div className="reportsHeaderCopy">
          <h1>Rapor Merkezi</h1>
          <p>Rapor verileri yükleniyor…</p>
        </div>
      </header>
    </div>
  </main>;
}
