"use server";

import { hashShortSetupCode, openSetupToken, shortSetupCodePattern } from "@/lib/guardian/setup-token";
import { createClient } from "@supabase/supabase-js";

export async function setPortalPassword(token: string, password: string) {
    const invalidLink = "Bağlantı geçersiz veya süresi dolmuş. Sprint’ten yeni bağlantı isteyin.";
    if (typeof token !== "string") return invalidLink;
    if (typeof password !== "string" || password.length < 8 || password.length > 100 || password !== password.trim()) {
        return "Şifreniz 8–100 karakter olmalı ve başında veya sonunda boşluk içermemelidir.";
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
    let sealedToken = token;
    let codeHash: string | undefined;
    let accountId: string | undefined;
    if (shortSetupCodePattern.test(token)) {
        codeHash = hashShortSetupCode(token);
        const { data: link, error } = await admin.from("guardian_setup_links")
            .select("sealed_token,account_id").eq("code_hash", codeHash)
            .gt("expires_at", new Date().toISOString()).maybeSingle();
        if (error) return "Bağlantı şu anda doğrulanamadı. Tekrar deneyin.";
        if (!link) return invalidLink;
        sealedToken = link.sealed_token;
        accountId = link.account_id;
    }
    const recoveryToken = openSetupToken(sealedToken);
    if (!recoveryToken) return invalidLink;

    const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
    const { data, error } = await auth.auth.verifyOtp({ token_hash: recoveryToken, type: "recovery" });
    if (error || !data.user || !data.session) {
        return "Bağlantının süresi dolmuş veya bağlantı kullanılmış. Sprint’ten yeni bağlantı isteyin.";
    }

    if (accountId && data.user.id !== accountId) return invalidLink;
    if (codeHash) await admin.from("guardian_setup_links").delete().eq("code_hash", codeHash);

    const { data: profile } = await admin.from("profiles").select("organization_id")
        .eq("id", data.user.id).eq("role", "guardian").eq("is_active", true).maybeSingle();
    if (!profile?.organization_id) return "Portal erişimi doğrulanamadı.";
    const { data: guardian } = await admin.from("guardians").select("id")
        .eq("auth_user_id", data.user.id).eq("organization_id", profile.organization_id)
        .eq("is_active", true).eq("login_enabled", true).maybeSingle();
    if (!guardian) return "Portal erişimi doğrulanamadı.";

    const result = await auth.auth.updateUser({ password });
    if (!result.error || result.error.code === "same_password") return null;

    console.warn("[portal-sifre] Password update rejected", {
        code: result.error.code,
        status: result.error.status,
    });
    if (result.error.code === "weak_password") {
        return "Şifreniz güvenlik kurallarını karşılamıyor. Sprint’ten yeni bağlantı isteyin ve daha güçlü bir şifre seçin.";
    }
    return "Şifre kaydedilemedi. Yeni bağlantı almak için giriş ekranından şifre yenileme talebi gönderin.";
}
