"use client";
import { useActionState } from "react";
import { saveSettingsTemplate, type SaveState } from "./central-actions";
export default function TemplateForm({ template }: { template: { template_key: string; title: string; body: string; version: number } }) {
  const [state,action,pending] = useActionState<SaveState,FormData>(saveSettingsTemplate,{ok:false,message:""});
  const variables=Array.from(new Set(template.body.match(/\{\{?[a-zA-Z0-9_]+\}\}?/g)||[]));
  return <details className="centralTemplate"><summary>{template.title} · Sürüm {state.revision ?? template.version}</summary><form action={action}>
    <input type="hidden" name="template_key" value={template.template_key}/><input type="hidden" name="version" value={state.revision ?? template.version}/>
    <label>Şablon başlığı<input name="title" defaultValue={template.title} required maxLength={180}/></label>
    <label>Mesaj metni<textarea name="body" defaultValue={template.body} required maxLength={10000}/></label>
    <p style={{fontSize:11,color:"#61758d",overflowWrap:"anywhere"}}>Mevcut değişkenler: {variables.join(" · ") || "Bu şablonda değişken bulunmuyor."}</p>
    {state.message?<p role="status" className={state.ok?"centralSuccess":"centralError"}>{state.message}</p>:null}
    <button type="submit" disabled={pending}>{pending?"Kaydediliyor…":"Şablonu Kaydet"}</button>
  </form></details>;
}
