"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import UiIcon from "@/app/components/ui-icon";
import "./support-survey.css";

const SatisfactionForm = dynamic(() => import("./satisfaction-form"), {
  loading: () => <p role="status">Anket yükleniyor…</p>,
});

export default function SatisfactionSurvey(props: { id: string; studentId: string }) {
  const [hasOpened, setHasOpened] = useState(false);
  return <details className="guardianSurveyCard" onToggle={event => {
    if (event.currentTarget.open) setHasOpened(true);
  }}>
    <summary className="surveyToggle">
      <span><strong>Memnuniyet Anketi</strong><small>Deneyiminizi değerlendirin veya bir sorun bildirin</small></span>
      <UiIcon name="chevronDown" className="surveyChevron"/>
    </summary>
    {hasOpened && <div className="surveyBody"><SatisfactionForm {...props}/></div>}
  </details>;
}
