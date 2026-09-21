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
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("alerts")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: profile.id,
      updated_at: now,
    })
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) throw error;

  // Uyarı tamamlandığında ona bağlı canlı bildirimi de açık bırakma.
  await supabase
    .from("system_notifications")
    .update({ is_read: true, read_at: now })
    .eq("organization_id", profile.organization_id)
    .eq("source_type", "attendance_reminder")
    .eq("source_id", id);

  revalidatePath("/uyarilar");
  revalidatePath("/bildirimler");
  revalidatePath("/");
}

export async function reopenAlert(formData: FormData) {
  const profile = await requireProfile([...roles]);
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Uyarı bulunamadı.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({
      status: "open",
      completed_at: null,
      completed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", profile.organization_id);

  if (error) throw error;

  revalidatePath("/uyarilar");
  revalidatePath("/");
}
