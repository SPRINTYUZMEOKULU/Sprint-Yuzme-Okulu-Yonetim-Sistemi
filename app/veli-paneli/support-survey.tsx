"use client";

import { useActionState, useState } from "react";
import { satisfactionTopics, scoreLabels } from "@/lib/guardian/satisfaction";
import { submitSatisfaction } from "./satisfaction-action";
import "./support-survey.css";

const phone = "0551 896 83 19";
const whatsApp = `https://wa.me/90${phone.replace(/\s/g, "").slice(1)}?text=`;

export function SprintSupport() {
  return <section className="guardianSupportCard" aria-labelledby="sprint-support-heading">
    <div className="guardianSupportHead">
      <span className="guardianSupportIcon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.2-3.1A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h9M8 15h6"/></svg></span>
      <div><h2 id="sprint-support-heading">SPRİNT Bilgilendirme Hattı</h2><p>{phone}</p></div>
      <a className="guardianWhatsAppButton" href={whatsApp + encodeURIComponent("Merhaba, SPRİNT Bilgilendirme Hattı ile görüşmek istiyorum.")}
        target="_blank" rel="noopener noreferrer">WhatsApp’ta Görüş</a>
    </div>
  </section>;
}

export default function SatisfactionSurvey({ id }: { id: string }) {
  const [submissionId] = useState(id);
  const [result, action, pending] = useActionState(submitSatisfaction.bind(null, submissionId), { sent: false, message: "" });
  return <section className="guardianSurveyCard" aria-labelledby="satisfaction-heading">
    <h2 id="satisfaction-heading">Memnuniyet Anketi</h2>
    <p className="guardianSurveyPrivacy"><strong>Kimliğiniz gizli tutulur.</strong> Adınız ve öğrenci bilgileriniz anket kaydına eklenmez. Yanıtlar yalnızca Yönetim Kurulu Başkanlığı tarafından incelenir. Eğitmenler ve diğer kurum personeli yanıtlarınıza erişemez. Gerekli adımları Başkanlık değerlendirir.</p>
    {result.sent ? <p className="guardianSurveyResult" role="status">{result.message}</p> :
      <form action={action} className="guardianSurveyForm">
        <fieldset>
          <legend>SPRİNT deneyiminizi nasıl değerlendirirsiniz?</legend>
          <div className="guardianSurveyScores">{scoreLabels.map((label, index) =>
            <label key={label}><input type="radio" name="rating" value={index + 1} required aria-label={`${index + 1} · ${label}`}/>
              <span>{index + 1}</span></label>)}</div>
          <div className="guardianSurveyScale"><span>Çok memnuniyetsizim</span><span>Çok memnunum</span></div>
        </fieldset>
        <label>Konu<select name="topic" defaultValue="" required><option value="" disabled>Konu seçin</option>
          {Object.entries(satisfactionTopics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Görüşünüz <small>(isteğe bağlı)</small><textarea name="comment" maxLength={1200} rows={4}
          placeholder="Lütfen ad, telefon veya öğrenci bilgisi yazmayın."/></label>
        <button className="guardianSurveySubmit" type="submit" disabled={pending}>{pending ? "Gönderiliyor…" : "Anketi Gönder"}</button>
        {result.message && <p role="alert">{result.message}</p>}
      </form>}
  </section>;
}
