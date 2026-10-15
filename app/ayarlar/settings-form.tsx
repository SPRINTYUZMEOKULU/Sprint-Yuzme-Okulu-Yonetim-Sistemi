"use client";
import { useActionState } from "react";
import { Icons } from "@/app/components/dashboard-icons";
import { settingDefinitions, type SettingSection, type SettingValues } from "@/lib/settings/schema";
import { saveCentralSettings, type SaveState } from "./central-actions";
export default function SettingsForm({ section, values, revision, updatedAt }: { section: SettingSection; values: SettingValues; revision: number; updatedAt: string | null }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveCentralSettings, { ok: false, message: "" });
  const definition = settingDefinitions[section];
  return <form action={action} className="centralForm">
    <input type="hidden" name="section" value={section} /><input type="hidden" name="revision" value={state.revision ?? revision} />
    <div className="centralImpact"><Icons.branch width={20} height={20} /><div><strong>Uygulandığı yerler</strong><p>{definition.applies}</p></div></div>
    <div className="centralFields">{definition.fields.map(field => <label key={field.key} className={field.type === "textarea" || field.type === "boolean" ? "centralWide" : ""}>
      {field.type === "boolean" ? <span className="centralSwitch"><input type="checkbox" name={field.key} defaultChecked={Boolean(values[field.key])} /><span>{field.label}</span></span> : <><span>{field.label}{field.required ? " *" : ""}</span>{field.type === "textarea" ? <textarea name={field.key} defaultValue={String(values[field.key] ?? "")} rows={3} maxLength={2000} required={field.required} /> : <input type={field.type} name={field.key} defaultValue={String(values[field.key] ?? "")} required={field.required} min={field.min} max={field.max} maxLength={400} />}</>}
      {field.help ? <small>{field.help}</small> : null}
    </label>)}</div>
    {state.message ? <p role="status" className={state.ok ? "centralSuccess" : "centralError"}>{state.message}</p> : null}
    <footer className="centralSave"><span>{(state.savedAt || updatedAt) ? `Son kayıt: ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(state.savedAt || updatedAt!))}` : "Kurum varsayılanları kullanılıyor."}<small>Değişiklikler geçmiş kayıtların içeriğini değiştirmez.</small></span><button type="submit" disabled={pending}><Icons.check width={18} height={18} />{pending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</button></footer>
  </form>;
}
