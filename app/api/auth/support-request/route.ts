import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MANAGEMENT_ROLES = ["owner", "admin", "branch_manager"];
const VALID_KINDS = ["password", "contact", "login_error"];
const VALID_ROLES = ["guardian", "coach", "admin"];
const VALID_METHODS = ["email", "phone"];

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function localPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

function phoneMatches(stored: string | null, wanted: string) {
  if (!stored || !wanted) return false;
  return localPhone(stored) === wanted;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const kind = clean(payload.kind, 30);
    const role = clean(payload.role, 30);
    const method = clean(payload.method, 20);
    const identifier = clean(payload.identifier, 160);
    const message = clean(payload.message, 1000);

    if (!VALID_KINDS.includes(kind) || !VALID_ROLES.includes(role) || !VALID_METHODS.includes(method)) {
      return NextResponse.json({ ok: false, message: "Geçersiz destek talebi." }, { status: 400 });
    }
    if (!identifier || !message) {
      return NextResponse.json({ ok: false, message: "İletişim bilgisi ve mesaj zorunludur." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      return NextResponse.json({ ok: false, message: "Destek servisi yapılandırılmamış." }, { status: 503 });
    }

    const admin = createAdminClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let account: {
      id: string;
      organization_id: string | null;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      role: string | null;
    } | null = null;

    if (method === "email") {
      const { data } = await admin
        .from("profiles")
        .select("id,organization_id,full_name,email,phone,role")
        .ilike("email", identifier.toLowerCase())
        .limit(1)
        .maybeSingle();
      account = data || null;
    } else {
      const wanted = localPhone(identifier);
      if (wanted) {
        const { data } = await admin
          .from("profiles")
          .select("id,organization_id,full_name,email,phone,role")
          .not("phone", "is", null)
          .limit(1000);
        account = (data || []).find((row) => phoneMatches(row.phone, wanted)) || null;
      }
    }

    let organizationId = account?.organization_id || null;
    if (!organizationId) {
      const { data: organization } = await admin
        .from("organizations")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      organizationId = organization?.id || null;
    }

    if (!organizationId) {
      return NextResponse.json({ ok: false, message: "Kurum kaydı bulunamadı." }, { status: 500 });
    }

    const { data: managers, error: managersError } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("role", MANAGEMENT_ROLES);

    if (managersError) {
      console.error("SPRINTOS LOGIN SUPPORT MANAGERS", managersError);
      return NextResponse.json({ ok: false, message: "Yönetici hesapları okunamadı." }, { status: 500 });
    }

    const managerIds = (managers || []).map((item) => String(item.id));
    if (!managerIds.length) {
      return NextResponse.json({ ok: false, message: "Destek talebini alacak yönetici bulunamadı." }, { status: 500 });
    }

    const kindLabel =
      kind === "password"
        ? "Şifre yenileme talebi"
        : kind === "login_error"
          ? "Giriş sorunu"
          : "İletişim talebi";
    const roleLabel = role === "guardian" ? "Veli" : role === "coach" ? "Eğitmen" : "Yönetici";
    const accountLabel = account?.full_name || identifier;
    const eventKey = `login_support_${kind}`;
    const targetPath = account
      ? `/kullanicilar-ve-yetkiler?profile=${encodeURIComponent(account.id)}`
      : "/bildirimler";
    const requestBody = `${roleLabel} giriş ekranından destek talebi gönderildi. ${message}`;
    const requestMessage =
      `${kindLabel}\nKullanıcı: ${accountLabel}\nİletişim: ${identifier}\nRol: ${roleLabel}\nMesaj: ${message}`;

    // Login destek akışı oturum açmadan çalıştığı için genel bildirim yönlendirme
    // motoruna bağımlı değildir. Böylece tercih/kapsam/push tarafındaki bir hata,
    // kullanıcının destek talebini kaybetmesine yol açmaz.
    const duplicateSince = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let duplicateQuery = admin
      .from("system_notifications")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("event_key", eventKey)
      .eq("is_read", false)
      .gte("created_at", duplicateSince)
      .limit(1);

    if (account?.id) {
      duplicateQuery = duplicateQuery.eq("source_id", account.id);
    } else {
      duplicateQuery = duplicateQuery.contains("metadata", {
        identifier,
        login_role: role,
        login_method: method,
      });
    }

    const { data: recentDuplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
    if (duplicateError) {
      console.error("SPRINTOS LOGIN SUPPORT DUPLICATE CHECK", duplicateError);
    }

    if (!recentDuplicate) {
      const rows = managerIds.map((managerId) => ({
        organization_id: organizationId,
        recipient_profile_id: managerId,
        recipient_user_id: managerId,
        notification_type: "login_support_request",
        title: `${kindLabel}: ${accountLabel}`,
        body: requestBody,
        message: requestMessage,
        priority: kind === "password" || kind === "login_error" ? "high" : "normal",
        severity: kind === "login_error" ? "warning" : "info",
        category: "accounts",
        student_id: null,
        source_type: "login_support",
        source_id: account?.id || null,
        target_path: targetPath,
        event_key: eventKey,
        is_read: false,
        push_required: false,
        push_requested: false,
        push_sent: false,
        push_sent_at: null,
        entity_type: account ? "profile" : "login_contact",
        entity_id: account?.id || null,
        metadata: {
          kind,
          login_role: role,
          login_method: method,
          identifier,
          account_found: Boolean(account),
          requested_message: message,
          requested_at: new Date().toISOString(),
        },
        created_by: null,
      }));

      const { error: insertError } = await admin.from("system_notifications").insert(rows);
      if (insertError) {
        console.error("SPRINTOS LOGIN SUPPORT INSERT", insertError);
        return NextResponse.json(
          { ok: false, message: "Talep yönetim ekranına kaydedilemedi. Lütfen tekrar deneyin." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      duplicate: Boolean(recentDuplicate),
      account_found: Boolean(account),
      message: recentDuplicate
        ? "Talebiniz zaten yönetime iletilmiş durumda."
        : "Talebiniz yönetime iletildi.",
    });
  } catch (error) {
    console.error("SPRINTOS LOGIN SUPPORT REQUEST", error);
    return NextResponse.json({ ok: false, message: "Talep gönderilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
