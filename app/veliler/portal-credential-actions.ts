"use server";
import { activePortalStudentIds } from "@/lib/guardian/portal-student-eligibility";
import { createClient } from '@supabase/supabase-js';
import { requireProfile } from '@/lib/auth/profile';
import { hashShortSetupCode, newShortSetupCode, sealSetupToken, setupLinkLifetimeMs } from '@/lib/guardian/setup-token';
import { normalizePortalPhone } from '@/lib/guardian/portal-recipient';
import { revalidateGuardianConnection } from '@/lib/guardian/revalidate';
const roles = ['owner', 'admin', 'branch_manager', 'registration_staff'] as const;
export async function portalCredentialContact(input: {
    accountId?: string;
    studentId?: string;
}) {
    const actor = await requireProfile([...roles]);
    const org = actor.organization_id;
    if (!org)
        return { ok: false as const, message: 'Kurum bulunamadı.' };
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    let accountId = input.accountId;
    if (input.studentId) {
        const { data: student } = await admin.from('students').select('id').eq('id', input.studentId).eq('organization_id', org).maybeSingle();
        if (!student)
            return { ok: false as const, message: 'Kursiyer bulunamadı.' };
        const { data: links, error } = await admin.from('guardian_students').select('guardian_id,is_primary').eq('student_id', student.id).eq('portal_access', true).order('is_primary', { ascending: false });
        if (error)
            return { ok: false as const, message: 'Portal bağlantısı okunamadı.' };
        if (links && links.length > 1 && links.filter(link => link.is_primary).length !== 1)
            return { ok: false as const, message: 'Birden fazla portal hesabı bağlı. Veli merkezinden birincil hesabı belirleyin.' };
        const selectedLink = links?.find(link => link.is_primary) ?? links?.[0];
        if (selectedLink) {
            const { data: record, error: recordError } = await admin.from('guardians').select('auth_user_id')
                .eq('organization_id', org).eq('id', selectedLink.guardian_id).maybeSingle();
            if (recordError || !record?.auth_user_id)
                return { ok: false as const, message: 'Seçili veli hesabının giriş bağlantısı eksik. Veli merkezinden kontrol edin.' };
            accountId = record.auth_user_id;
        }
    }
    if (!accountId)
        return { ok: false as const, message: 'Kursiyere bağlı portal hesabı bulunamadı.' };
    const [{ data: profile }, { data: guardian }, { data: auth, error }] = await Promise.all([
        admin.from('profiles').select('id,full_name,phone,email,is_active').eq('organization_id', org).eq('role', 'guardian').eq('id', accountId).maybeSingle(),
        admin.from('guardians').select('id,is_active,login_enabled').eq('organization_id', org).eq('auth_user_id', accountId).maybeSingle(),
        admin.auth.admin.getUserById(accountId),
    ]);
    if (!profile || !guardian || error || !auth.user)
        return { ok: false as const, message: 'Portal hesabının bağlantıları eksik. Veli merkezinden kontrol edin.' };
    if (!profile.is_active || guardian.is_active === false || guardian.login_enabled === false)
        return { ok: false as const, message: 'Portal erişimi pasif. Önce erişimi aktif edin.' };
    const { data: eligibleLinks, error: eligibilityError } = await admin.from('guardian_students')
        .select('student_id').eq('guardian_id', guardian.id).eq('portal_access', true);
    if (eligibilityError)
        return { ok: false as const, message: 'Portal bağlantısı doğrulanamadı.' };
    const linkedStudentIds = (eligibleLinks || []).map(link => link.student_id)
        .filter(id => !input.studentId || id === input.studentId);
    const activeIds = await activePortalStudentIds(admin, org, linkedStudentIds).catch(() => new Set<string>());
    if (!activeIds.size)
        return { ok: false as const, message: 'Bu işlem için aktif bir kursiyer bağlantısı doğrulanmalıdır.' };
    return { ok: true as const, accountId, fullName: profile.full_name || 'Değerli Velimiz', phone: profile.phone || '', email: profile.email || '', revision: auth.user.updated_at || auth.user.created_at };
}
export async function savePortalCredential(input: {
    accountId?: string;
    studentId?: string;
}, password: string) {
    const contact = await portalCredentialContact(input);
    if (!contact.ok)
        return contact;
    if (password.length < 8 || password.length > 100 || /[\r\n`]/.test(password) || password !== password.trim())
        return { ok: false as const, message: 'Şifre 8–100 karakter olmalı; başında/sonunda boşluk, satır sonu veya ters tırnak içermemelidir.' };
    const actor = await requireProfile([...roles]);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.auth.admin.updateUserById(contact.accountId, { password });
    if (error || !data.user)
        return { ok: false as const, message: 'Şifre kaydedilemedi. Yeniden deneyin.' };
    // Audit only the account and linked students; never log passwords.
    try {
        const {data: guardian} = await admin.from('guardians').select('id').eq('organization_id', actor.organization_id).eq('auth_user_id', contact.accountId).maybeSingle();
        const {data: links} = guardian ? await admin.from('guardian_students').select('student_id').eq('guardian_id', guardian.id) : {data: []};
        if (links?.length) {
            await admin.from('student_activity_logs').insert(links.map(link => ({organization_id:actor.organization_id,student_id:link.student_id,activity_type:'guardian_portal_password_reset',title:'Portal şifresi yenilendi',description:'Portal şifresi ortak giriş bilgileri ekranından güncellendi.',source_type:'guardian_portal',source_id:contact.accountId,performed_at:new Date().toISOString()})));
            for (const link of links) revalidateGuardianConnection(contact.accountId, link.student_id);
        }
    } catch { /* Authentication succeeded; audit availability must not misreport it. */ }
    revalidateGuardianConnection(contact.accountId, input.studentId || '');
    return { ...contact, password, revision: data.user.updated_at || data.user.created_at, message: 'Şifre kaydedildi.' };
}

export async function createPortalSetupLink(input: { accountId?: string; studentId?: string }) {
    const contact = await portalCredentialContact(input);
    if (!contact.ok) return contact;
    const phone = normalizePortalPhone(contact.phone);
    if (!phone) return { ok: false as const, message: 'Geçerli WhatsApp telefonu bulunamadı.' };

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: account, error: accountError } = await admin.auth.admin.getUserById(contact.accountId);
    if (accountError || !account.user) return { ok: false as const, message: 'Portal hesabının giriş kimliği bulunamadı.' };

    let loginEmail = account.user.email;
    if (!loginEmail) {
        if (normalizePortalPhone(account.user.phone) !== phone)
            return { ok: false as const, message: 'Kayıtlı telefon ile portal giriş telefonu eşleşmiyor. Veli merkezinden kontrol edin.' };

        const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(contact.accountId, {
            email: `phone.${phone.slice(3)}@login.sprintos.local`,
            email_confirm: true,
            user_metadata: { ...account.user.user_metadata, sprintos_phone_login: true },
        });
        if (updateError || updated.user?.id !== contact.accountId || !updated.user.email)
            return { ok: false as const, message: 'Telefonla giriş kimliği hazırlanamadı. Veli merkezinden kontrol edin.' };
        loginEmail = updated.user.email;
    }

    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: loginEmail });
    const token = data?.properties?.hashed_token;
    if (error || data.user?.id !== contact.accountId || !token) {
        return { ok: false as const, message: 'Şifre oluşturma bağlantısı hazırlanamadı.' };
    }
    const code = newShortSetupCode();
    const { error: linkError } = await admin.from('guardian_setup_links').insert({
        code_hash: hashShortSetupCode(code),
        account_id: contact.accountId,
        sealed_token: sealSetupToken(token),
        expires_at: new Date(Date.now() + setupLinkLifetimeMs).toISOString(),
    });
    if (linkError) return { ok: false as const, message: 'Şifre oluşturma bağlantısı kaydedilemedi. Tekrar deneyin.' };

    await admin.from('guardian_setup_links').delete()
        .eq('account_id', contact.accountId).lte('expires_at', new Date().toISOString());
    return { ...contact, phone, setupPath: '/s#' + code };
}
