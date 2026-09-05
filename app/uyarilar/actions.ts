"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const roles = ["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"] as const;

export async function resolveAlert(formData: FormData) {
  const profile = await requireProfile([...roles]);
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Uyarı bulunamadı.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) {
    const fallback = await supabase
      .from("alerts")
      .update({ status: "resolved" })
      .eq("id", id)
      .eq("organization_id", profile.organization_id);
    if (fallback.error) throw fallback.error;
  }

  revalidatePath("/uyarilar");
  revalidatePath("/");
}

export async function reopenAlert(formData: FormData) {
  const profile = await requireProfile([...roles]);
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Uyarı bulunamadı.");
  const supabase = await createClient();
  const { error } = await supabase.from("alerts").update({ status: "open" }).eq("id", id).eq("organization_id", profile.organization_id);
  if (error) throw error;
  revalidatePath("/uyarilar");
  revalidatePath("/");
}
