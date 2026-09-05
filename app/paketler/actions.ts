"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const clean = (value: FormDataEntryValue | null) => String(value || "").trim();
const allowed = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;

export async function createPackage(formData: FormData) {
  const profile = await requireProfile([...allowed]);
  if (!profile.organization_id) throw new Error("Kurum bilgisi bulunamadı.");
  const supabase = await createClient();

  const name = clean(formData.get("name"));
  const lessonCount = Number(formData.get("lesson_count"));
  const price = Number(formData.get("price"));
  const courseType = clean(formData.get("course_type")) || null;

  if (!name) throw new Error("Paket adı zorunludur.");
  if (!Number.isInteger(lessonCount) || lessonCount <= 0) throw new Error("Ders sayısı geçersiz.");
  if (!Number.isFinite(price) || price < 0) throw new Error("Paket ücreti geçersiz.");

  const { error } = await supabase.from("course_packages").insert({
    organization_id: profile.organization_id,
    name,
    lesson_count: lessonCount,
    price,
    course_type: courseType,
    is_active: true,
  });
  if (error) throw error;
  revalidatePath("/paketler");
  revalidatePath("/on-kayit");
  revalidatePath("/on-kayitlar");
}

export async function updatePackage(formData: FormData) {
  const profile = await requireProfile([...allowed]);
  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  const lessonCount = Number(formData.get("lesson_count"));
  const price = Number(formData.get("price"));
  const courseType = clean(formData.get("course_type")) || null;

  if (!id || !name) throw new Error("Paket bilgisi eksik.");
  if (!Number.isInteger(lessonCount) || lessonCount <= 0) throw new Error("Ders sayısı geçersiz.");
  if (!Number.isFinite(price) || price < 0) throw new Error("Paket ücreti geçersiz.");

  const { error } = await supabase.from("course_packages").update({
    name,
    lesson_count: lessonCount,
    price,
    course_type: courseType,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("organization_id", profile.organization_id);
  if (error) throw error;
  revalidatePath("/paketler");
  revalidatePath("/on-kayit");
  revalidatePath("/on-kayitlar");
}

export async function togglePackage(formData: FormData) {
  const profile = await requireProfile([...allowed]);
  const supabase = await createClient();
  const id = clean(formData.get("id"));
  const isActive = clean(formData.get("is_active")) === "true";
  if (!id) throw new Error("Paket bulunamadı.");

  const { error } = await supabase.from("course_packages").update({
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("organization_id", profile.organization_id);
  if (error) throw error;
  revalidatePath("/paketler");
  revalidatePath("/on-kayit");
}
