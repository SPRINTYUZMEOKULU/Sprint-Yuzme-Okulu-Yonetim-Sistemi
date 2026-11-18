"use client";

import { useActionState } from "react";
import { publishGuardianInvoice } from "./actions";

export default function PublishForm({ id, recipients, existing, preferredRecipient, number, type }: {
  id: string;
  recipients: { id: string; full_name: string | null }[];
  existing: boolean;
  preferredRecipient: string;
  number: string;
  type: string;
}) {
  const [message, action, pending] = useActionState(publishGuardianInvoice.bind(null, id), "");
  return <form action={action} style={{display:"grid",gap:14,maxWidth:540}}>
    {!existing && <>
      <label>Belgenin paylaşılacağı veli<select name="recipient" defaultValue={preferredRecipient} required>
        <option value="" disabled>Veli hesabı seçin</option>
        {recipients.map(item => <option value={item.id} key={item.id}>{item.full_name || "İsimsiz veli hesabı"}</option>)}
      </select></label>
      <label>Belge türü<select name="document_type" required defaultValue={type}>
        <option value="">Belge türü seçin</option><option value="e_invoice">e-Fatura</option>
        <option value="e_archive">e-Arşiv Fatura</option><option value="e_smm">e-Serbest Meslek Makbuzu</option>
      </select></label>
      <label>Belge numarası<input name="document_number" defaultValue={number} required maxLength={80}/></label>
      <label>Düzenlenmiş belge PDF’i<input name="pdf" type="file" accept="application/pdf,.pdf" required/></label>
      <label><input name="verified" type="checkbox" required/> PDF’in bu tahsilata ve seçili veliye ait olduğunu kontrol ettim.</label>
    </>}
    <button type="submit" disabled={pending || (!existing && recipients.length === 0)}>
      {pending ? "Kaydediliyor…" : existing ? "Bildirimi yeniden dene" : "Veli paneline ekle ve bildir"}
    </button>
    {message && <p role="status">{message}</p>}
  </form>;
}
