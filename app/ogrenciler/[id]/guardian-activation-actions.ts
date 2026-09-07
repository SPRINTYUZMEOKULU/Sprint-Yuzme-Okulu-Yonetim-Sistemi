"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";

const roles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createGuardianActivationLink(studentIdValue: string) {
  const profile = await requireProfile([...roles]);
  const organizationId = profile.organization_id;
  const studentId = String(studentIdValue || "").trim();
  if (!organizationId || !studentId) return { ok: false as const, message: "Öğrenci bulunamadı." };

  const admin = adminClient();
  const { data: link } = await admin
    .from("guardian_students")
    .select("guardian_id")
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  if (!link?.guardian_id) return { ok: false as const, message: "Öğrenciye bağlı veli hesabı bulunamadı." };

  const { data: guardian } = await admin
    .from("profiles")
    .select("id,full_name,email,phone,role,organization_id")
    .eq("id", link.guardian_id)
    .eq("organization_id", organizationId)
    .eq("role", "guardian")
    .maybeSingle();

  if (!guardian) return { ok: false as const, message: "Veli hesabı bulunamadı." };
  const email = String(guardian.email || "").trim().toLowerCase();
  if (!email) {
    return {
      ok: false as const,
      code: "email_required" as const,
      message: "Güvenli aktivasyon bağlantısı oluşturmak için veli e-posta adresi gerekli.",
    };
  }

  const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const redirectTo = siteUrl ? `${siteUrl}/auth/callback?next=/veli-paneli` : undefined;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (error || !data?.properties?.action_link) {
    return { ok: false as const, message: error?.message || "Aktivasyon bağlantısı oluşturulamadı." };
  }

  return {
    ok: true as const,
    message: "Tek kullanımlık veli aktivasyon bağlantısı hazırlandı.",
    activationUrl: data.properties.action_link,
    guardian: {
      fullName: guardian.full_name || "Değerli Velimiz",
      email,
      phone: guardian.phone || "",
    },
  };
}
