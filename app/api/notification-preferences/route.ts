import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set([
  "preregistration",
  "students",
  "attendance",
  "finance",
  "payment",
  "cash",
  "approvals",
  "staff",
  "accounts",
  "permissions",
  "schedule",
  "operations",
  "reports",
  "system",
]);
const SCOPES = new Set(["all", "branches", "assigned"]);

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu ayarları eksik.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,organization_id,role,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active || !profile.organization_id || !["owner", "admin"].includes(String(profile.role))) return null;
  return profile as { id: string; organization_id: string; role: string; is_active: boolean };
}

type RuleInput = {
  profileId?: string;
  category?: string;
  inAppEnabled?: boolean;
  pushEnabled?: boolean;
  canApprove?: boolean;
  scope?: string;
};

export async function PUT(request: Request) {
  try {
    const actor = await requireAdmin();
    if (!actor) return NextResponse.json({ ok: false, error: "Bu işlem için yönetici yetkisi gerekiyor." }, { status: 403 });

    const body = await request.json().catch(() => null) as { rules?: RuleInput[] } | null;
    const rules = Array.isArray(body?.rules) ? body!.rules! : [];
    if (!rules.length) return NextResponse.json({ ok: false, error: "Kaydedilecek bildirim kuralı bulunamadı." }, { status: 400 });
    if (rules.length > 500) return NextResponse.json({ ok: false, error: "Tek işlemde en fazla 500 kural kaydedilebilir." }, { status: 400 });

    const profileIds = Array.from(new Set(rules.map((r) => String(r.profileId || "")).filter(Boolean)));
    const admin = adminClient();
    const { data: validProfiles, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", actor.organization_id)
      .eq("is_active", true)
      .in("id", profileIds);
    if (profileError) throw profileError;
    const validIds = new Set((validProfiles ?? []).map((p) => String(p.id)));

    const rows = rules.map((rule) => {
      const profileId = String(rule.profileId || "");
      const category = String(rule.category || "");
      const scope = String(rule.scope || "assigned");
      if (!validIds.has(profileId)) throw new Error("Geçersiz veya başka organizasyona ait kullanıcı seçildi.");
      if (!CATEGORIES.has(category)) throw new Error(`Geçersiz bildirim kategorisi: ${category}`);
      if (!SCOPES.has(scope)) throw new Error(`Geçersiz bildirim kapsamı: ${scope}`);
      return {
        organization_id: actor.organization_id,
        profile_id: profileId,
        category,
        in_app_enabled: rule.inAppEnabled !== false,
        push_enabled: rule.pushEnabled === true,
        can_approve: rule.canApprove === true,
        scope,
        created_by: actor.id,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await admin
      .from("notification_user_preferences")
      .upsert(rows, { onConflict: "organization_id,profile_id,category" });
    if (error) throw error;

    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Bildirim kuralları kaydedilemedi." }, { status: 500 });
  }
}
