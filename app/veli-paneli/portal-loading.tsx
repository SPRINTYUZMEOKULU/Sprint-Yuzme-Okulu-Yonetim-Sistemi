import './veli.css';

export default function PortalLoading({title = "Veli Paneli"}: {title?: string}) {
  return <main className="guardianShell" aria-busy="true">
    <div className="guardianContent">
      <h1 className="guardianSectionTitle">{title}</h1>
      <p className="guardianSectionLead" role="status">Yükleniyor…</p>
    </div>
  </main>;
}
