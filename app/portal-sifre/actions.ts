"use server";

import { openSetupToken } from "@/lib/guardian/setup-token";
import { createClient } from "@supabase/supabase-js";

export async function setPortalPassword(token: string, password: string) {
    const recoveryToken = typeof token === "string" ? openSetupToken(token) : null;
    if (!recoveryToken) return "Bağlantı geçersiz veya süresi dolmuş. Sprint’ten yeni bağlantı isteyin.";
    if (typeof password !== "string" || password.length < 8 || password.length > 100 || password !== password.trim()) {
        return "Şifreniz 8–100 karakter olmalı ve başında veya sonunda boşluk içermemelidir.";
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
    const { data, error } = await auth.auth.verifyOtp({ token_hash: recoveryToken, type: "recovery" });
    if (error || !data.user || !data.session) {
        return "Bağlantının süresi dolmuş veya bağlantı kullanılmış. Sprint’ten yeni bağlantı isteyin.";
    }

    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
    const { data: profile } = await admin.from("profiles").select("organization_id")
        .eq("id", data.user.id).eq("role", "guardian").eq("is_active", true).maybeSingle();
    if (!profile?.organization_id) return "Portal erişimi doğrulanamadı.";
    const { data: guardian } = await admin.from("guardians").select("id")
        .eq("auth_user_id", data.user.id).eq("organization_id", profile.organization_id)
        .eq("is_active", true).eq("login_enabled", true).maybeSingle();
    if (!guardian) return "Portal erişimi doğrulanamadı.";

    const result = await auth.auth.updateUser({ password });
    return result.error ? "Şifre kaydedilemedi. Sprint’ten yeni bağlantı isteyin." : null;
}
