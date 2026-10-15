import { createClient as createAdminClient } from "@supabase/supabase-js";
import { settingDefaults, type SettingSection, type SettingValues } from "./schema";
export function settingsAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("Sunucu bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function readSettings(client: any, organizationId: string, section: SettingSection): Promise<{ values: SettingValues; revision: number; updatedAt: string | null }> {
  const { data, error } = await client.from("organization_settings").select("config,revision,updated_at").eq("organization_id", organizationId).eq("section", section).maybeSingle();
  if (error) throw Error("Kurum ayarları yüklenemedi.");
  let defaults = settingDefaults[section];
  if (section === "kurum") {
    const { data: org, error: orgError } = await client.from("organizations").select("name,legal_name,phone,email,website").eq("id", organizationId).single();
    if (orgError || !org) throw Error("Kurum bilgileri yüklenemedi.");
    defaults = { ...defaults, display_name: org.name, legal_name: org.legal_name || "", phone: org.phone || "", email: org.email || "", website: org.website || "" };
  }
  return { values: { ...defaults, ...(data?.config || {}) }, revision: data?.revision || 0, updatedAt: data?.updated_at || null };
}
