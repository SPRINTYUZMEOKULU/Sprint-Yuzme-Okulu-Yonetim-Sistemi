import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { NotificationCategory } from "@/lib/notifications/create-notification";
import { publishEventNotification } from "@/lib/notifications/publish-event";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set<NotificationCategory>([
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
  return profile as { id: string; organization_id: string; role: string };
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    if (!actor) {
      return NextResponse.json({ ok: false, error: "Bu işlem için yönetici yetkisi gerekiyor." }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as {
      profileId?: string;
      category?: NotificationCategory;
      push?: boolean;
    } | null;

    const profileId = String(body?.profileId || "").trim();
    const category = body?.category;
    const push = body?.push === true;

    if (!profileId || !category || !CATEGORIES.has(category)) {
      return NextResponse.json({ ok: false, error: "Geçerli kullanıcı ve bildirim kategorisi seçilmelidir." }, { status: 400 });
    }

    const admin = adminClient();
    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id,full_name,role,is_active")
      .eq("organization_id", actor.organization_id)
      .eq("id", profileId)
      .eq("is_active", true)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return NextResponse.json({ ok: false, error: "Seçilen kullanıcı aktif değil veya bu organizasyona ait değil." }, { status: 404 });
    }

    const published = await publishEventNotification({
      organization_id: actor.organization_id,
      recipient_profile_id: profileId,
      title: "SprintOS Bildirim Testi",
      body: `${String(target.full_name || "Kullanıcı")} için ${category} kategorisinde gerçek dağıtım testi oluşturuldu.`,
      category,
      event_key: "notification-routing-test",
      notification_type: "notification-routing-test",
      severity: "info",
      priority: "normal",
      target_path: "/bildirimler",
      push_requested: push,
      created_by: actor.id,
      metadata: {
        isRoutingTest: true,
        testedProfileId: profileId,
        testedRole: String(target.role || ""),
        testedCategory: category,
      },
    });
    const result = published.results[0];
    if (!result) throw new Error(published.error?.message || "Test bildirimi oluşturulamadı.");

    return NextResponse.json({
      ...result,
      target: {
        id: profileId,
        name: String(target.full_name || "Kullanıcı"),
        role: String(target.role || ""),
      },
      category,
      blocked: result.recipientCount === 0,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Bildirim dağıtım testi çalıştırılamadı.",
    }, { status: 500 });
  }
}
