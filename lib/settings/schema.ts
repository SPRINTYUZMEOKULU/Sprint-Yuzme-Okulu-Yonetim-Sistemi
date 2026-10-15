export type SettingField = { key: string; label: string; type: "text" | "textarea" | "email" | "url" | "number" | "boolean"; help?: string; min?: number; max?: number; required?: boolean };
export const settingDefinitions = {
  kurum: { title: "Kurum ve Marka", description: "Kurumun başvuru formunda ve raporlarda kullanılan bilgileri.", applies: "Ön kayıt sayfası ve yönetim raporları", fields: [
    { key: "display_name", label: "Görünen kurum adı", type: "text", required: true },
    { key: "legal_name", label: "Resmî unvan", type: "text" },
    { key: "phone", label: "İletişim telefonu", type: "text" },
    { key: "email", label: "İletişim e-postası", type: "email" },
    { key: "website", label: "Web sitesi", type: "url" },
    { key: "logo_url", label: "Logo bağlantısı", type: "url", help: "Herkese açık HTTPS görsel adresi. Boş bırakılırsa mevcut Sprint logosu kullanılır." },
    { key: "address", label: "Kurum adresi", type: "textarea" },
  ] as SettingField[] },
  kayit: { title: "Kayıt ve Başvuru", description: "Başvuru kabulünü ve kursiyerin gördüğü karşılama metnini yönetin.", applies: "Ön kayıt sayfası ve başvuru kabul servisi", fields: [
    { key: "public_enabled", label: "Online ön kayıt başvuruları açık", type: "boolean" },
    { key: "welcome_text", label: "Başvuru karşılama metni", type: "textarea", required: true },
    { key: "closed_text", label: "Başvuru kapalıyken gösterilecek mesaj", type: "textarea", required: true },
  ] as SettingField[] },
  ders: { title: "Ders ve Yoklama", description: "Eksik yoklama bildirimlerinin ne zaman oluşacağını belirleyin.", applies: "Arka plan yoklama denetimi ve bildirimler", fields: [
    { key: "missing_alert_enabled", label: "Eksik yoklama bildirimi oluştur", type: "boolean" },
    { key: "missing_alert_minutes", label: "Ders başlangıcından kaç dakika sonra uyarı gelsin?", type: "number", min: 5, max: 180, required: true },
  ] as SettingField[] },
  gruplar: { title: "Grup Varsayılanları", description: "Yeni grup oluşturulurken kullanılacak varsayılan kontenjanı belirleyin.", applies: "Yeni grup formu ve grup oluşturma işlemi", fields: [
    { key: "default_capacity", label: "Yeni gruplar için varsayılan kontenjan", type: "number", min: 1, max: 50, required: true },
  ] as SettingField[] },
  sistem: { title: "Rapor ve Çıktı", description: "Yönetim raporlarının ekran ve baskı metinlerini düzenleyin.", applies: "Rapor Merkezi ve A4/PDF baskı görünümü", fields: [
    { key: "report_title", label: "Rapor başlığı", type: "text", required: true },
    { key: "report_footer", label: "Rapor alt bilgisi", type: "textarea" },
  ] as SettingField[] },
};
export type SettingSection = keyof typeof settingDefinitions;
export type SettingValues = Record<string, string | number | boolean>;
export const settingDefaults: Record<SettingSection, SettingValues> = {
  kurum: { display_name: "Sprint Yüzme Okulu", legal_name: "", phone: "", email: "", website: "", logo_url: "", address: "" },
  kayit: { public_enabled: true, welcome_text: "Bilgilerinizi doldurun, sizi uygun gruba yönlendirelim.", closed_text: "Online başvurular geçici olarak kapalıdır. Bilgi almak için bizimle iletişime geçebilirsiniz." },
  ders: { missing_alert_enabled: true, missing_alert_minutes: 15 },
  gruplar: { default_capacity: 6 },
  sistem: { report_title: "Rapor Merkezi", report_footer: "" },
};
export function isSettingSection(value: string): value is SettingSection { return Object.hasOwn(settingDefinitions, value); }
export function validateSettingValues(section: SettingSection, input: Record<string, unknown>): SettingValues {
  const values: SettingValues = {};
  for (const field of settingDefinitions[section].fields) {
    const raw = input[field.key];
    if (field.type === "boolean") { if (typeof raw !== "boolean") throw Error(`${field.label}: geçersiz seçim.`); values[field.key] = raw; continue; }
    if (field.type === "number") { const n = typeof raw === "number" ? raw : Number(raw); if (raw === "" || raw == null || !Number.isInteger(n) || n < (field.min ?? 0) || n > (field.max ?? 100000)) throw Error(`${field.label}: ${field.min}–${field.max} arasında tam sayı girin.`); values[field.key] = n; continue; }
    if (typeof raw !== "string") throw Error(`${field.label}: metin girin.`);
    const text = raw.trim(); const max = field.type === "textarea" ? 2000 : 400;
    if (text.length > max || (field.required && !text)) throw Error(`${field.label}: ${field.required ? "zorunlu alan; " : ""}en fazla ${max} karakter.`);
    if (text && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw Error("Geçerli bir e-posta adresi girin.");
    if (text && field.type === "url") { let url: URL; try { url = new URL(text); } catch { throw Error(`${field.label}: geçerli bir HTTPS adresi girin.`); } if (url.protocol !== "https:" || url.username || url.password) throw Error(`${field.label}: HTTPS adresi kullanın.`); }
    values[field.key] = text;
  }
  return values;
}
