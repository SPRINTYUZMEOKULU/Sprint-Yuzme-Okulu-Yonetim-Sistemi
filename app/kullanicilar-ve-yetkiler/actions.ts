"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const PAGE_PATH = "/kullanicilar-ve-yetkiler";

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
  "guardian",
] as const;

type UserRole = (typeof ALLOWED_ROLES)[number];

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("90") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `+90${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `+90${digits}`;
  }

  if (value.startsWith("+")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function isAllowedRole(value: string): value is UserRole {
  return ALLOWED_ROLES.includes(value as UserRole);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY bulunamadı. Vercel Environment Variables bölümüne eklenmelidir."
    );
  }

  return createAdminClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireOwnerOrAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Bu işlem için giriş yapmalısınız.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Kullanıcı profili bulunamadı.");
  }

  if (!profile.is_active) {
    throw new Error("Hesabınız pasif durumda.");
  }

  if (!["owner", "admin"].includes(String(profile.role))) {
    throw new Error("Bu işlem için yönetici yetkiniz bulunmuyor.");
  }

  if (!profile.organization_id) {
    throw new Error("Organizasyon bilgisi bulunamadı.");
  }

  return {
    user,
    profile,
  };
}

async function assertStaffBelongsToOrganization(
  staffId: string,
  organizationId: string
) {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, organization_id, role, full_name, email, phone, is_active")
    .eq("id", staffId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error("Personel bulunamadı veya bu organizasyona ait değil.");
  }

  return data;
}

export async function createStaff(formData: FormData) {
  const { profile: currentProfile } = await requireOwnerOrAdmin();
  const admin = getAdminClient();

  const fullName = clean(formData.get("full_name"));
  const rawEmail = clean(formData.get("email"));
  const rawPhone = clean(formData.get("phone"));
  const password = clean(formData.get("password"));
  const requestedRole = clean(formData.get("role"));

  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  const phone = rawPhone ? normalizePhone(rawPhone) : "";

  if (!fullName) {
    throw new Error("Ad soyad zorunludur.");
  }

  if (!email && !phone) {
    throw new Error("E-posta veya telefon numarasından en az biri zorunludur.");
  }

  if (!password || password.length < 8) {
    throw new Error("Şifre en az 8 karakter olmalıdır.");
  }

  if (!isAllowedRole(requestedRole)) {
    throw new Error("Geçersiz kullanıcı rolü.");
  }

  if (requestedRole === "owner") {
    throw new Error(
      "Yeni owner hesabı bu ekrandan oluşturulamaz. Süper kullanıcı yetkisini ayrıca verebilirsiniz."
    );
  }

  const branchIds = formData
    .getAll("branch_ids")
    .map((item) => String(item))
    .filter(Boolean);

  const permissionKeys = formData
    .getAll("permission_keys")
    .map((item) => String(item))
    .filter(Boolean);

  if (branchIds.length > 0) {
    const { data: validBranches, error: branchError } = await admin
      .from("branches")
      .select("id")
      .eq("organization_id", currentProfile.organization_id)
      .in("id", branchIds);

    if (branchError) {
      throw new Error(`Şubeler kontrol edilemedi: ${branchError.message}`);
    }

    if ((validBranches ?? []).length !== new Set(branchIds).size) {
      throw new Error("Seçilen şubelerden biri organizasyona ait değil.");
    }
  }

  if (permissionKeys.length > 0) {
    const { data: validPermissions, error: permissionError } = await admin
      .from("permission_definitions")
      .select("permission_key")
      .eq("is_active", true)
      .in("permission_key", permissionKeys);

    if (permissionError) {
      throw new Error(
        `Yetkiler kontrol edilemedi: ${permissionError.message}`
      );
    }

    if ((validPermissions ?? []).length !== new Set(permissionKeys).size) {
      throw new Error("Seçilen yetkilerden biri geçersiz.");
    }
  }

  const createPayload: {
    email?: string;
    phone?: string;
    password: string;
    email_confirm?: boolean;
    phone_confirm?: boolean;
    user_metadata: Record<string, string>;
  } = {
    password,
    user_metadata: {
      full_name: fullName,
      role: requestedRole,
      organization_id: String(currentProfile.organization_id),
    },
  };

  if (email) {
    createPayload.email = email;
    createPayload.email_confirm = true;
  }

  if (phone) {
    createPayload.phone = phone;
    createPayload.phone_confirm = true;
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser(createPayload);

  if (createError || !created.user) {
    throw new Error(
      `Kullanıcı oluşturulamadı: ${
        createError?.message ?? "Bilinmeyen hata"
      }`
    );
  }

  const newUserId = created.user.id;

  try {
    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          organization_id: currentProfile.organization_id,
          branch_id: branchIds[0] ?? null,
          email: email || null,
          phone: phone || null,
          full_name: fullName,
          role: requestedRole,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      throw new Error(`Profil kaydedilemedi: ${profileError.message}`);
    }

    if (branchIds.length > 0) {
      const branchRows = branchIds.map((branchId) => ({
        organization_id: currentProfile.organization_id,
        staff_id: newUserId,
        branch_id: branchId,
      }));

      const { error: branchInsertError } = await admin
        .from("staff_branches")
        .insert(branchRows);

      if (branchInsertError) {
        throw new Error(
          `Personel şubeleri kaydedilemedi: ${branchInsertError.message}`
        );
      }
    }

    if (permissionKeys.length > 0) {
      const permissionRows = permissionKeys.map((permissionKey) => ({
        organization_id: currentProfile.organization_id,
        staff_id: newUserId,
        permission_key: permissionKey,
        is_allowed: true,
      }));

      const { error: permissionInsertError } = await admin
        .from("staff_permissions")
        .insert(permissionRows);

      if (permissionInsertError) {
        throw new Error(
          `Personel yetkileri kaydedilemedi: ${permissionInsertError.message}`
        );
      }
    }
  } catch (error) {
    await admin.auth.admin.deleteUser(newUserId);
    throw error;
  }

  revalidatePath(PAGE_PATH);

  return;
}

export async function updateStaffProfile(formData: FormData) {
  const { profile: currentProfile } = await requireOwnerOrAdmin();
  const admin = getAdminClient();

  const staffId = clean(formData.get("staff_id"));
  const fullName = clean(formData.get("full_name"));
  const rawEmail = clean(formData.get("email"));
  const rawPhone = clean(formData.get("phone"));
  const requestedRole = clean(formData.get("role"));

  if (!staffId) {
    throw new Error("Personel ID bulunamadı.");
  }

  await assertStaffBelongsToOrganization(
    staffId,
    currentProfile.organization_id
  );

  if (!fullName) {
    throw new Error("Ad soyad zorunludur.");
  }

  if (!isAllowedRole(requestedRole)) {
    throw new Error("Geçersiz kullanıcı rolü.");
  }

  if (requestedRole === "owner") {
    throw new Error("Owner rolü bu ekrandan atanamaz.");
  }

  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  const phone = rawPhone ? normalizePhone(rawPhone) : "";

  const authAttributes: {
    email?: string;
    phone?: string;
    user_metadata?: Record<string, string>;
  } = {
    user_metadata: {
      full_name: fullName,
      role: requestedRole,
      organization_id: String(currentProfile.organization_id),
    },
  };

  if (email) {
    authAttributes.email = email;
  }

  if (phone) {
    authAttributes.phone = phone;
  }

  const { error: authError } =
    await admin.auth.admin.updateUserById(staffId, authAttributes);

  if (authError) {
    throw new Error(`Auth hesabı güncellenemedi: ${authError.message}`);
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      role: requestedRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staffId)
    .eq("organization_id", currentProfile.organization_id);

  if (profileError) {
    throw new Error(`Profil güncellenemedi: ${profileError.message}`);
  }

  revalidatePath(PAGE_PATH);

  return {
    success: true,
  };
}

export async function setStaffActive(formData: FormData) {
  const { user, profile: currentProfile } = await requireOwnerOrAdmin();
  const admin = getAdminClient();

  const staffId = clean(formData.get("staff_id"));
  const activeValue = clean(formData.get("is_active"));

  if (!staffId) {
    throw new Error("Personel ID bulunamadı.");
  }

  if (staffId === user.id && activeValue !== "true") {
    throw new Error("Kendi hesabınızı pasif duruma getiremezsiniz.");
  }

  await assertStaffBelongsToOrganization(
    staffId,
    currentProfile.organization_id
  );

  const isActive = activeValue === "true";

  const { error } = await admin
    .from("profiles")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staffId)
    .eq("organization_id", currentProfile.organization_id);

  if (error) {
    throw new Error(`Hesap durumu değiştirilemedi: ${error.message}`);
  }

  if (!isActive) {
    const { error: signOutError } =
      await admin.auth.admin.signOut(staffId, "global");

    if (signOutError) {
      console.warn(
        "Kullanıcı oturumları kapatılamadı:",
        signOutError.message
      );
    }
  }

  revalidatePath(PAGE_PATH);

  return {
    success: true,
    isActive,
  };
}

export async function changeStaffPassword(formData: FormData) {
  const { profile: currentProfile } = await requireOwnerOrAdmin();
  const admin = getAdminClient();

  const staffId = clean(formData.get("staff_id"));
  const newPassword = clean(formData.get("password"));

  if (!staffId) {
    throw new Error("Personel ID bulunamadı.");
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Yeni şifre en az 8 karakter olmalıdır.");
  }

  await assertStaffBelongsToOrganization(
    staffId,
    currentProfile.organization_id
  );

  const { error } = await admin.auth.admin.updateUserById(staffId, {
    password: newPassword,
  });

  if (error) {
    throw new Error(`Şifre değiştirilemedi: ${error.message}`);
  }

  await admin.auth.admin.signOut(staffId, "global");

  revalidatePath(PAGE_PATH);

  return {
    success: true,
  };
}

export async function setStaffBranches(formData: FormData) {
  const { profile: currentProfile } = await requireOwnerOrAdmin();
  const admin = getAdminClient();

  const staffId = clean(formData.get("staff_id"));

  const branchIds = formData
    .getAll("branch_ids")
    .map((item) => String(item))
    .filter(Boolean);

  if (!staffId) {
    throw new Error("Personel ID bulunamadı.");
  }

  await assertStaffBelongsToOrganization(
    staffId,
    currentProfile.organization_id
  );

  if (branchIds.length > 0) {
    const { data: validBranches, error: branchError } = await admin
      .from("branches")
      .select("id")
      .eq("organization_id", currentProfile.organization_id)
      .in("id", branchIds);

    if (branchError) {
      throw new Error(`Şubeler kontrol edilemedi: ${branchError.message}`);
    }

    if ((validBranches ?? []).length !== new Set(branchIds).size) {
      throw new Error("Seçilen şubelerden biri organizasyona ait değil.");
    }
  }

  const { error: deleteError } = await admin
    .from("staff_branches")
    .delete()
    .eq("organization_id", currentProfile.organization_id)
    .eq("staff_id", staffId);

  if (deleteError) {
    throw new Error(
      `Eski şube atamaları kaldırılamadı: ${deleteError.message}`
    );
  }

  if (branchIds.length > 0) {
    const rows = [...new Set(branchIds)].map((branchId) => ({
      organization_id: currentProfile.organization_id,
      staff_id: staffId,
      branch_id: branchId,
    }));

    const { error: insertError } = await admin
      .from("staff_branches")
      .insert(rows);

    if (insertError) {
      throw new Error(
        `Yeni şube atamaları kaydedilemedi: ${insertError.message}`
      );
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      branch_id: branchIds[0] ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staffId)
    .eq("organization_id", currentProfile.organization_id);

  if (profileError) {
    throw new Error(
      `Ana şube bilgisi güncellenemedi: ${profileError.message}`
    );
  }

  revalidatePath(PAGE_PATH);

  return {
    success: true,
  };
}

export async function setStaffPermission(formData: FormData) {
  const { profile: currentProfile } = await requireOwnerOrAdmin();
  const admin = getAdminClient();

  const staffId = clean(formData.get("staff_id"));
  const permissionKey = clean(formData.get("permission_key"));
  const allowedValue = clean(formData.get("is_allowed"));

  if (!staffId || !permissionKey) {
    throw new Error("Personel veya yetki bilgisi eksik.");
  }

  await assertStaffBelongsToOrganization(
    staffId,
    currentProfile.organization_id
  );

  const { data: permissionDefinition, error: permissionError } =
    await admin
      .from("permission_definitions")
      .select("permission_key, is_active")
      .eq("permission_key", permissionKey)
      .eq("is_active", true)
      .single();

  if (permissionError || !permissionDefinition) {
    throw new Error("Geçersiz veya pasif yetki.");
  }

  const isAllowed = allowedValue === "true";

  const { error } = await admin
    .from("staff_permissions")
    .upsert(
      {
        organization_id: currentProfile.organization_id,
        staff_id: staffId,
        permission_key: permissionKey,
        is_allowed: isAllowed,
      },
      {
        onConflict: "organization_id,staff_id,permission_key",
      }
    );

  if (error) {
    throw new Error(`Yetki değiştirilemedi: ${error.message}`);
  }

  revalidatePath(PAGE_PATH);

  return {
    success: true,
    permissionKey,
    isAllowed,
  };
}

export async function setAllStaffPermissions(formData: FormData) {
  const { profile: currentProfile } = await requireOwnerOrAdmin();
  const admin = getAdminClient();

  const staffId = clean(formData.get("staff_id"));
  const allowedValue = clean(formData.get("is_allowed"));

  if (!staffId) {
    throw new Error("Personel ID bulunamadı.");
  }

  await assertStaffBelongsToOrganization(
    staffId,
    currentProfile.organization_id
  );

  const isAllowed = allowedValue === "true";

  const { data: permissions, error: permissionError } = await admin
    .from("permission_definitions")
    .select("permission_key")
    .eq("is_active", true);

  if (permissionError) {
    throw new Error(
      `Yetki listesi alınamadı: ${permissionError.message}`
    );
  }

  if (!permissions?.length) {
    throw new Error("Aktif yetki tanımı bulunamadı.");
  }

  const rows = permissions.map((permission) => ({
    organization_id: currentProfile.organization_id,
    staff_id: staffId,
    permission_key: permission.permission_key,
    is_allowed: isAllowed,
  }));

  const { error } = await admin
    .from("staff_permissions")
    .upsert(rows, {
      onConflict: "organization_id,staff_id,permission_key",
    });

  if (error) {
    throw new Error(`Yetkiler değiştirilemedi: ${error.message}`);
  }

  revalidatePath(PAGE_PATH);

  return {
    success: true,
    isAllowed,
  };
}

export async function setAccountingPermissions(
  formData: FormData
) {
  const { profile: currentProfile } = await requireOwnerOrAdmin();
  const admin = getAdminClient();

  const staffId = clean(formData.get("staff_id"));
  const allowedValue = clean(formData.get("is_allowed"));

  if (!staffId) {
    throw new Error("Personel ID bulunamadı.");
  }

  await assertStaffBelongsToOrganization(
    staffId,
    currentProfile.organization_id
  );

  const isAllowed = allowedValue === "true";

  const { data: definitions, error: definitionsError } = await admin
    .from("permission_definitions")
    .select("permission_key, module_key")
    .eq("is_active", true);

  if (definitionsError) {
    throw new Error(
      `Muhasebe yetkileri alınamadı: ${definitionsError.message}`
    );
  }

  const accountingPermissions = (definitions ?? []).filter((item) => {
    const moduleKey = String(item.module_key ?? "").toLowerCase();
    const permissionKey = String(
      item.permission_key ?? ""
    ).toLowerCase();

    return (
      moduleKey.includes("account") ||
      moduleKey.includes("payment") ||
      moduleKey.includes("cash") ||
      moduleKey.includes("finance") ||
      permissionKey.includes("account") ||
      permissionKey.includes("payment") ||
      permissionKey.includes("cash") ||
      permissionKey.includes("finance")
    );
  });

  if (!accountingPermissions.length) {
    throw new Error(
      "Muhasebe/ödeme/kasa modüllerine ait aktif yetki tanımı bulunamadı."
    );
  }

  const rows = accountingPermissions.map((permission) => ({
    organization_id: currentProfile.organization_id,
    staff_id: staffId,
    permission_key: permission.permission_key,
    is_allowed: isAllowed,
  }));

  const { error } = await admin
    .from("staff_permissions")
    .upsert(rows, {
      onConflict: "organization_id,staff_id,permission_key",
    });

  if (error) {
    throw new Error(
      `Muhasebe yetkileri değiştirilemedi: ${error.message}`
    );
  }

  revalidatePath(PAGE_PATH);

  return {
    success: true,
    isAllowed,
  };
}

export async function generateLoginMessage(formData: FormData) {
  const { profile: currentProfile } = await requireOwnerOrAdmin();

  const staffId = clean(formData.get("staff_id"));
  const password = clean(formData.get("password"));

  if (!staffId) {
    throw new Error("Personel ID bulunamadı.");
  }

  if (!password) {
    throw new Error("Gönderilecek geçici şifreyi giriniz.");
  }

  const staff = await assertStaffBelongsToOrganization(
    staffId,
    currentProfile.organization_id
  );

  const loginName = staff.phone || staff.email || "Tanımlı kullanıcı hesabınız";

  const message = `SPRİNT YÜZME OKULU – SprintOS Giriş Bilgileri

Sayın ${staff.full_name || "Personelimiz"},

SprintOS personel hesabınız oluşturulmuştur.

Kullanıcı Adı / Giriş:
${loginName}

Geçici Şifreniz:
${password}

Güvenlik Uyarısı:
Giriş bilgilerinizi ve şifrenizi hiç kimseyle paylaşmayınız. Şifreniz yalnızca size özeldir. Şüpheli bir giriş veya yetkisiz erişim fark etmeniz halinde Sprint Yüzme Okulu yönetimine bilgi veriniz.

İlk girişinizden sonra şifrenizi değiştirmeniz önerilir.

Sprint Yüzme Okulu Yönetimi`;

  return {
    success: true,
    message,
    phone: staff.phone,
    email: staff.email,
  };
}
