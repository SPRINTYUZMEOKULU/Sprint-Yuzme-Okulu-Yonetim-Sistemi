"use client";
import { useState } from "react";
import CustomerDocumentForm from "./customer-document-form";

type Details = Record<"recipient_type"|"recipient_name"|"tax_identity_number"|"tax_office"|"address"|"city"|"district"|"postal_code"|"email"|"phone", string | null>;
export function DocumentDetailsToggle({token,details}:{token:string;details:Details}) {
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState(false);
  const mask=(s:string|null)=>s ? "••••" + s.slice(-2) : "—";
  return <section className="document-details-panel">
    <button type="button" className="details-toggle" onClick={()=>{setOpen(!open);setEditing(false)}} aria-expanded={open}>{open ? "▾ Belge Bilgilerimi Gizle" : "▸ Belge Bilgilerim"}</button>
    {open && (editing ? <CustomerDocumentForm token={token} editing onCancel={()=>setEditing(false)}/> : <div className="details-summary">
      <p><b>Alıcı:</b> {details.recipient_name || "—"}</p>
      <p><b>Tür:</b> {details.recipient_type==="company"?"Kurumsal":"Bireysel"}</p>
      <p><b>Kimlik / Vergi No:</b> {mask(details.tax_identity_number)}</p>
      {details.tax_office && <p><b>Vergi Dairesi:</b> {details.tax_office}</p>}
      <p><b>Adres:</b> {details.address || "—"}, {details.district || ""} / {details.city || ""}</p>
      <p><b>Posta Kodu:</b> {details.postal_code || "—"}</p>
      <p><b>E-posta:</b> {mask(details.email)}</p>
      <p><b>Telefon:</b> {mask(details.phone)}</p>
      <button type="button" className="details-edit" onClick={()=>setEditing(true)}>Bilgilerimi Düzenle</button>
    </div>)}
  </section>;
}
