import UiIcon from "@/app/components/ui-icon";
import "./support-survey.css";

const phone = "0551 896 83 19";
const whatsApp = `https://wa.me/90${phone.replace(/\s/g, "").slice(1)}?text=`;

export default function SprintSupport() {
  return <section className="guardianSupportCard" aria-labelledby="sprint-support-heading">
    <div className="guardianSupportHead">
      <span className="guardianSupportIcon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.2-3.1A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h9M8 15h6"/></svg></span>
      <div><h2 id="sprint-support-heading">SPRİNT Bilgilendirme Hattı</h2><p>{phone}</p></div>
      <a className="guardianWhatsAppButton" href={whatsApp + encodeURIComponent("Merhaba, SPRİNT Bilgilendirme Hattı ile görüşmek istiyorum.")}
        target="_blank" rel="noopener noreferrer">WhatsApp’ta Görüş <UiIcon name="arrowRight" size={16}/></a>
    </div>
  </section>;
}
