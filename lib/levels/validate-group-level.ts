import type { SupabaseClient } from "@supabase/supabase-js";

/** Existing passive assignments may be preserved; new assignments must be active. */
export async function validateGroupLevel(db: SupabaseClient, organizationId: string, levelId: string | null, previousLevelId?: string | null) {
  if (!levelId) return;
  const { data, error } = await db.from("swimming_levels").select("id,is_active")
    .eq("organization_id", organizationId).eq("id", levelId).maybeSingle();
  if (error) throw error;
  if (!data || (!data.is_active && levelId !== previousLevelId)) {
    throw new Error("Seviye Yönetimi listesinden aktif bir seviye seçin. Güncel seçenekler için sayfayı yenileyin.");
  }
}
