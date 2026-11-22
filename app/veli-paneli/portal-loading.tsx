import "./veli.css";
import "./course-summary.css";

export default function PortalLoading({title = "Veli Paneli"}: {title?: string}) {
  return <main className="guardianShell guardianLoading">
    <header className="guardianTop">
      <div className="guardianBrand">
        <span className="guardianBrandMark guardianPortalMark"><img src="/sprint-portal-logo.webp" width={32} height={32} alt="" /></span>
        <span><strong>SPRİNT</strong><small>Yüzme Okulu Portalı</small></span>
      </div>
    </header>
    <div className="guardianContent">
      <h1 className="guardianSectionTitle">{title}</h1>
      <p className="guardianSectionLead" role="status">Bilgiler yükleniyor…</p>
      <div className="guardianLoadingBar" aria-hidden="true" />
      <div className="guardianLoadingPanel" aria-hidden="true" />
    </div>
  </main>;
}
