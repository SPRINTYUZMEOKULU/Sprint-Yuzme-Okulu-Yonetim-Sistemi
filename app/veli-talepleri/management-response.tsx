"use client";

import { useState } from "react";

export default function ManagementResponse({ previous }: { previous: string }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  return <div className="requestResponseEditor">
    {previous ? <button type="button" className="guardianButton" onClick={() => {
      setBody(editing ? "" : previous.replace(/^Düzeltme\s*\n+/, ""));
      setEditing(!editing);
    }}>{editing ? "Düzeltmeden Vazgeç" : "Son Yanıtı Düzelt"}</button> : null}
    <input type="hidden" name="correct_response" value={editing ? "yes" : ""} />
    <label>{editing ? "Düzeltilmiş yanıt" : "Veliye gönderilecek yeni yanıt"}
      <textarea name="guardian_response" rows={4} maxLength={3980} value={body}
        onChange={event => setBody(event.target.value)} required={editing}
        placeholder="Yanıtınızı yazın. Görüşme geçmişi korunur." />
    </label>
    {editing ? <small>Düzeltme, aynı görüşmeye eklenir ve veliye bildirim gider.</small> : null}
  </div>;
}
