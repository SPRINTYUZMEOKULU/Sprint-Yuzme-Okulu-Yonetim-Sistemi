"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { isSettingSection, settingDefinitions, validateSettingValues } from "@/lib/settings/schema";
import { settingsAdmin } from "@/lib/settings/server";
export type SaveState = { ok: boolean; message: string; revision?: number; savedAt?: string };
export async function saveCentralSettings(_previous: SaveState, form: FormData): Promise<SaveState> {
  const profile = await requireProfile(["owner", "admin"]);
  if (!profile.organization_id) return { revision: _previous.revision, ok: false, message: "Kurum kaydı bulunamadı." };
  const section = String(form.get("section") || ""), revision = Number(form.get("revision"));
  if (!isSettingSection(section) || !Number.isInteger(revision) || revision < 0) return { revision: _previous.revision, ok: false, message: "Geçersiz ayar isteği." };
  try {
    const input = Object.fromEntries(settingDefinitions[section].fields.map(field => [field.key, field.type === "boolean" ? form.get(field.key) === "on" : form.get(field.key)]));
    const values = validateSettingValues(section, input);
    const { data, error } = await settingsAdmin().rpc("save_organization_settings", { p_organization_id: profile.organization_id, p_section: section, p_values: values, p_revision: revision, p_actor: profile.id });
    if (error) return { revision: _previous.revision, ok: false, message: error.message.includes("başka bir oturumda") ? "Ayarlar başka bir oturumda değiştirildi. Sayfayı yenileyip tekrar deneyin." : "Ayarlar kaydedilemedi. Yeniden deneyin." };
    revalidatePath("/ayarlar", "layout"); revalidatePath("/on-kayit"); revalidatePath("/raporlar"); revalidatePath("/gruplar");
    return { ok: true, message: "Ayarlar kaydedildi ve ilgili modüllere uygulandı.", revision: Number(data), savedAt: new Date().toISOString() };
  } catch (error) { return { revision: _previous.revision, ok: false, message: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." }; }
}

export async function saveSettingsTemplate(_previous: SaveState, form: FormData): Promise<SaveState> {
  const profile = await requireProfile(["owner", "admin"]);
  const key = String(form.get("template_key") || ""), title = String(form.get("title") || "").trim(), body = String(form.get("body") || "").trim(), version = Number(form.get("version"));
  if (!profile.organization_id || !key || !title || title.length > 180 || !body || body.length > 10000 || !Number.isInteger(version) || version < 1) return { revision: _previous.revision, ok: false, message: "Başlık ve metni kontrol edin; metin en fazla 10.000 karakter olabilir." };
  const db = settingsAdmin();
  const { data: existing, error: readError } = await db.from("message_templates").select("body").eq("organization_id",profile.organization_id).eq("template_key",key).maybeSingle();
  if (readError || !existing) return {revision:_previous.revision,ok:false,message:"Şablon bulunamadı."};
  const placeholders=(s:string)=>new Set(Array.from(s.matchAll(/\{\{?([a-zA-Z0-9_]+)\}\}?/g),m=>m[1]));
  const original=placeholders(existing.body), updated=placeholders(body);
  if (Array.from(updated).some(p=>!original.has(p))) return {revision:_previous.revision,ok:false,message:"Yeni bir değişken adı eklendi. Mevcut süslü parantezli değişken adlarını kullanın."};
  const { data, error } = await db.rpc("save_settings_message_template", { p_organization_id: profile.organization_id, p_key: key, p_title: title, p_body: body, p_version: version, p_actor: profile.id });
  if (error) return {revision:_previous.revision,ok:false,message:error.message.includes("başka bir oturumda")?"Şablon başka bir oturumda değiştirildi. Sayfayı yenileyin.":"Şablon kaydedilemedi."};
  revalidatePath("/ayarlar");revalidatePath("/hazir-mesajlar");revalidatePath("/odeme-bilgileri");revalidatePath("/kayit-tamamlama","layout");
  return {ok:true,message:"Şablon kaydedildi. Yeni hazırlanacak mesajlarda kullanılacak.",revision:Number(data),savedAt:new Date().toISOString()};
}
