"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const clean = (value: FormDataEntryValue | null) => String(value || "").trim();

export async function createBranch(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  if (!profile.organization_id) throw new Error("Kurum bilgisi bulunamadı.");
  const supabase = await createClient();

  const name = clean(formData.get("name"));
  if (!name) throw new Error("Şube adı zorunludur.");

  const { error } = await supabase.from("branches").insert({
    organization_id: profile.organization_id,
    name,
    pool_name: clean(formData.get("pool_name")) || null,
    address: clean(formData.get("address")) || null,
    location_url: clean(formData.get("location_url")) || null,
    contact_phone: clean(formData.get("contact_phone")) || null,
    whatsapp_phone: clean(formData.get("whatsapp_phone")) || null,
    working_hours: clean(formData.get("working_hours")) || null,
    public_registration: formData.get("public_registration") === "on",
    is_active: true,
    sort_order: Number(formData.get("sort_order") || 0)
  });
  if (error) throw error;
  revalidatePath("/subeler");
  revalidatePath("/gruplar");
  revalidatePath("/on-kayit");
}

export async function updateBranch(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  if (!id || !name) throw new Error("Şube bilgisi eksik.");

  const { error } = await supabase.from("branches").update({
    name,
    pool_name: clean(formData.get("pool_name")) || null,
    address: clean(formData.get("address")) || null,
    location_url: clean(formData.get("location_url")) || null,
    contact_phone: clean(formData.get("contact_phone")) || null,
    whatsapp_phone: clean(formData.get("whatsapp_phone")) || null,
    working_hours: clean(formData.get("working_hours")) || null,
    public_registration: formData.get("public_registration") === "on",
    sort_order: Number(formData.get("sort_order") || 0),
    updated_at: new Date().toISOString()
  }).eq("id", id).eq("organization_id", profile.organization_id);
  if (error) throw error;
  revalidatePath("/subeler");
  revalidatePath("/gruplar");
  revalidatePath("/on-kayit");
}

export async function toggleBranch(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const field = clean(formData.get("field"));
  const value = clean(formData.get("value")) === "true";
  if (!id || !["is_active", "public_registration"].includes(field)) throw new Error("Geçersiz işlem.");

  const { error } = await supabase.from("branches").update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", profile.organization_id);
  if (error) throw error;
  revalidatePath("/subeler");
  revalidatePath("/gruplar");
  revalidatePath("/on-kayit");
}
