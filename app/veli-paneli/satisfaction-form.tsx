"use client";

import { useActionState, useState } from "react";
import { satisfactionTopics, scoreLabels } from "@/lib/guardian/satisfaction";
import { submitSatisfaction } from "./satisfaction-action";

export default function SatisfactionForm({ id, studentId }: { id: string; studentId: string }) {
  const [submissionId] = useState(id);
  const [problem, setProblem] = useState("");
  const [result, action, pending] = useActionState(submitSatisfaction.bind(null, submissionId, studentId), { sent: false, message: "" });
  return <>
    <p className="guardianSurveyPrivacy"><strong>Yanıtınızı yalnızca Yönetim Kurulu Başkanlığı görür.</strong> Sorununuzu inceleyebilmek için yanıtınız hesap ve öğrenci bilgilerinizle birlikte iletilir. Eğitmenler, diğer personel ve veliler bu bilgilere erişemez.</p>
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
        <label>Bildirmek istediğiniz bir sorun var mı?
          <select name="problem" required value={problem} onChange={event => setProblem(event.target.value)}>
            <option value="" disabled>Seçin</option><option value="no">Hayır</option><option value="yes">Evet</option>
          </select>
        </label>
        <label>{problem === "yes" ? "Sorunu kısaca açıklayın" : "Görüşünüz (isteğe bağlı)"}<textarea name="comment" required={problem === "yes"} maxLength={1200} rows={4}
          placeholder="Lütfen ad, telefon veya öğrenci bilgisi yazmayın."/></label>
        <button className="guardianSurveySubmit" type="submit" disabled={pending}>{pending ? "Gönderiliyor…" : "Anketi Gönder"}</button>
        {result.message && <p role="alert">{result.message}</p>}
      </form>}
  </>;
}
