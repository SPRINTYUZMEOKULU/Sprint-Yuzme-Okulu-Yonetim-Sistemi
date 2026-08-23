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
  return value.trim().toLowerCase();
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

  return `+${digits}`;
}

function isAllowedRole(value: string): value is UserRole {
  return ALLOWED_ROLES.includes(value as UserRole);
}

function roleTitle(role: string) {
  const titles: Record<string, string> = {
    owner: "Sistem Sahibi",
    admin: "Yönetici",
    branch_manager: "Şube Yöneticisi",
    registration_staff: "Kayıt Personeli",
    accounting: "Muhasebe",
    coach: "Eğitmen",
    guardian: "Veli",
  };

  return titles[role] ?? role;
}

function splitName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return {
      firstName: "Personel",
      lastName: "-",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "-",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY bulunamadı. Vercel Environment Variables bölümüne ekleyin."
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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
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

async function getProfile(
  profileId: string,
  organizationId: string
) {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, organization_id, branch_id, full_name, email, phone, role, is_active"
    )
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error(
      "Kullanıcı bulunamadı veya bu organizasyona ait değil."
    );
  }

  return data;
}

async function getStaffByAuthUser(
  authUserId: string,
  organizationId: string
) {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("staff")
    .select(
      "id, organization_id, auth_user_id, first_name, last_name, phone, email, title, staff_type, is_active, login_enabled, is_super_user, must_change_password, all_branches"
    )
    .eq("organization_id", organizationId)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Personel kaydı okunamadı: ${error.message}`);
  }

  return data;
}

async function ensureStaffRecord(
  profileId: string,
  organizationId: string
) {
  const admin = getAdminClient();

  const profile = await getProfile(profileId, organizationId);

  const existing = await getStaffByAuthUser(
    profileId,
    organizationId
  );

  if (existing) {
    return existing;
  }

  const { firstName, lastName } = splitName(
    profile.full_name || profile.email || "Personel"
  );

  const { data: staff, error } = await admin
    .from("staff")
    .insert({
      organization_id: organizationId,
      auth_user_id: profileId,

      first_name: firstName,
      last_name: lastName,

      phone: profile.phone || null,
      email: profile.email || null,

      title: roleTitle(String(profile.role)),
      staff_type: String(profile.role || "coach"),

      is_active: Boolean(profile.is_active),
      login_enabled: true,
      is_super_user: profile.role === "owner",
      must_change_password: false,
      all_branches: profile.role === "owner",
    })
    .select(
      "id, organization_id, auth_user_id, first_name, last_name, phone, email, title, staff_type, is_active, login_enabled, is_super_user, must_change_password, all_branches"
    )
    .single();

  if (error || !staff) {
    throw new Error(
      `Personel kaydı oluşturulamadı: ${
        error?.message ?? "Bilinmeyen hata"
      }`
    );
  }

  return staff;
}

async function validateBranches(
  organizationId: string,
  branchIds: string[]
) {
  if (!branchIds.length) return;

  const admin = getAdminClient();

  const { data, error } = await admin
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", branchIds);

  if (error) {
    throw new Error(`Şubeler kontrol edilemedi: ${error.message}`);
  }

  if ((data ?? []).length !== new Set(branchIds).size) {
    throw new Error(
      "Seçilen şubelerden biri bu organizasyona ait değil."
    );
  }
}

async function getAllActiveBranchIds(organizationId: string) {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Şubeler alınamadı: ${error.message}`);
  }

  return (data ?? []).map((row) => String(row.id));
}

async function validatePermissions(permissionKeys: string[]) {
  if (!permissionKeys.length) return;

  const admin = getAdminClient();

  const { data, error } = await admin
    .from("permission_definitions")
    .select("permission_key")
    .eq("is_active", true)
    .in("permission_key", permissionKeys);

  if (error) {
    throw new Error(`Yetkiler kontrol edilemedi: ${error.message}`);
  }

  if ((data ?? []).length !== new Set(permissionKeys).size) {
    throw new Error("Seçilen yetkilerden biri geçersiz.");
  }
}

/* ============================================================
   YENİ KULLANICI
   ============================================================ */

export async function createStaff(
  formData: FormData
): Promise<void> {
  const { profile: currentProfile } =
    await requireOwnerOrAdmin();

  const admin = getAdminClient();

  const fullName = clean(formData.get("full_name"));
  const rawEmail = clean(formData.get("email"));
  const rawPhone = clean(formData.get("phone"));
  const password = clean(formData.get("password"));
  const requestedRole = clean(formData.get("role"));

  if (!fullName) {
    throw new Error("Ad soyad zorunludur.");
  }

  if (!isAllowedRole(requestedRole)) {
    throw new Error("Geçersiz kullanıcı rolü.");
  }

  if (requestedRole === "owner") {
    throw new Error(
      "Yeni Sistem Sahibi hesabı bu ekrandan oluşturulamaz."
    );
  }

  if (!password || password.length < 8) {
    throw new Error("Şifre en az 8 karakter olmalıdır.");
  }

  const email = rawEmail
    ? normalizeEmail(rawEmail)
    : "";

  const phone = rawPhone
    ? normalizePhone(rawPhone)
    : "";

  if (!email && !phone) {
    throw new Error(
      "E-posta veya telefon numarasından en az biri zorunludur."
    );
  }

  let branchIds = [
    ...new Set(
      formData
        .getAll("branch_ids")
        .map(String)
        .filter(Boolean)
    ),
  ];

  const allBranches =
    clean(formData.get("all_branches")) === "true";

  if (allBranches) {
    branchIds = await getAllActiveBranchIds(
      currentProfile.organization_id
    );
  }

  const permissionKeys = [
    ...new Set(
      formData
        .getAll("permission_keys")
        .map(String)
        .filter(Boolean)
    ),
  ];

  await validateBranches(
    currentProfile.organization_id,
    branchIds
  );

  await validatePermissions(permissionKeys);

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
      organization_id: String(
        currentProfile.organization_id
      ),
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

  const authUserId = created.user.id;

  let createdStaffId: string | null = null;

  try {
    /* PROFILE */

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: authUserId,

          organization_id:
            currentProfile.organization_id,

          branch_id:
            branchIds[0] ?? null,

          full_name: fullName,

          email:
            email || null,

          phone:
            phone || null,

          role:
            requestedRole,

          is_active:
            true,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      throw new Error(
        `Profil kaydedilemedi: ${profileError.message}`
      );
    }

    /* STAFF */

    const { firstName, lastName } =
      splitName(fullName);

    const isSuperUser =
      permissionKeys.includes(
        "system.superuser"
      );

    const { data: staffRow, error: staffError } =
      await admin
        .from("staff")
        .insert({
          organization_id:
            currentProfile.organization_id,

          auth_user_id:
            authUserId,

          first_name:
            firstName,

          last_name:
            lastName,

          phone:
            phone || null,

          email:
            email || null,

          title:
            roleTitle(requestedRole),

          staff_type:
            requestedRole,

          is_active:
            true,

          login_enabled:
            true,

          is_super_user:
            isSuperUser,

          must_change_password:
            true,

          all_branches:
            allBranches,
        })
        .select("id")
        .single();

    if (staffError || !staffRow) {
      throw new Error(
        `Personel kaydı oluşturulamadı: ${
          staffError?.message ??
          "Bilinmeyen hata"
        }`
      );
    }

    createdStaffId = staffRow.id;

    /* ŞUBELER */

    if (branchIds.length) {
      const branchRows =
        branchIds.map((branchId) => ({
          organization_id:
            currentProfile.organization_id,

          staff_id:
            createdStaffId,

          branch_id:
            branchId,
        }));

      const { error: branchError } =
        await admin
          .from("staff_branches")
          .insert(branchRows);

      if (branchError) {
        throw new Error(
          `Personel şubeleri kaydedilemedi: ${branchError.message}`
        );
      }
    }

    /* YETKİLER */

    if (permissionKeys.length) {
      const permissionRows =
        permissionKeys.map(
          (permissionKey) => ({
            organization_id:
              currentProfile.organization_id,

            staff_id:
              createdStaffId,

            permission_key:
              permissionKey,

            is_allowed:
              true,
          })
        );

      const { error: permissionError } =
        await admin
          .from("staff_permissions")
          .insert(permissionRows);

      if (permissionError) {
        throw new Error(
          `Personel yetkileri kaydedilemedi: ${permissionError.message}`
        );
      }
    }
  } catch (error) {
    if (createdStaffId) {
      await admin
        .from("staff")
        .delete()
        .eq("id", createdStaffId);
    }

    await admin.auth.admin.deleteUser(
      authUserId
    );

    throw error;
  }

  revalidatePath(PAGE_PATH);
}

/* ============================================================
   PROFİL
   ============================================================ */

export async function updateStaffProfile(
  formData: FormData
): Promise<void> {
  const { profile: currentProfile } =
    await requireOwnerOrAdmin();

  const admin = getAdminClient();

  const profileId =
    clean(formData.get("staff_id"));

  const fullName =
    clean(formData.get("full_name"));

  const rawEmail =
    clean(formData.get("email"));

  const rawPhone =
    clean(formData.get("phone"));

  const requestedRole =
    clean(formData.get("role"));

  if (!profileId) {
    throw new Error("Kullanıcı ID bulunamadı.");
  }

  const profile = await getProfile(
    profileId,
    currentProfile.organization_id
  );

  if (profile.role === "owner") {
    throw new Error(
      "Sistem Sahibi hesabı bu ekrandan değiştirilemez."
    );
  }

  if (!fullName) {
    throw new Error("Ad soyad zorunludur.");
  }

  if (
    !isAllowedRole(requestedRole) ||
    requestedRole === "owner"
  ) {
    throw new Error("Geçersiz kullanıcı rolü.");
  }

  const email = rawEmail
    ? normalizeEmail(rawEmail)
    : "";

  const phone = rawPhone
    ? normalizePhone(rawPhone)
    : "";

  if (!email && !phone) {
    throw new Error(
      "E-posta veya telefon numarasından en az biri zorunludur."
    );
  }

  const authAttributes: {
    email?: string;
    phone?: string;
    user_metadata: Record<string, string>;
  } = {
    user_metadata: {
      full_name: fullName,
      role: requestedRole,
      organization_id: String(
        currentProfile.organization_id
      ),
    },
  };

  if (email) {
    authAttributes.email = email;
  }

  if (phone) {
    authAttributes.phone = phone;
  }

  const { error: authError } =
    await admin.auth.admin.updateUserById(
      profileId,
      authAttributes
    );

  if (authError) {
    throw new Error(
      `Giriş hesabı güncellenemedi: ${authError.message}`
    );
  }

  const { error: profileError } =
    await admin
      .from("profiles")
      .update({
        full_name: fullName,

        email:
          email || null,

        phone:
          phone || null,

        role:
          requestedRole,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq(
        "organization_id",
        currentProfile.organization_id
      );

  if (profileError) {
    throw new Error(
      `Profil güncellenemedi: ${profileError.message}`
    );
  }

  const staff = await ensureStaffRecord(
    profileId,
    currentProfile.organization_id
  );

  const { firstName, lastName } =
    splitName(fullName);

  const { error: staffError } =
    await admin
      .from("staff")
      .update({
        first_name:
          firstName,

        last_name:
          lastName,

        phone:
          phone || null,

        email:
          email || null,

        title:
          roleTitle(requestedRole),

        staff_type:
          requestedRole,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", staff.id);

  if (staffError) {
    throw new Error(
      `Personel bilgisi güncellenemedi: ${staffError.message}`
    );
  }

  revalidatePath(PAGE_PATH);
}

/* ============================================================
   AKTİF / PASİF
   ============================================================ */

export async function setStaffActive(
  formData: FormData
): Promise<void> {
  const {
    user,
    profile: currentProfile,
  } = await requireOwnerOrAdmin();

  const admin = getAdminClient();

  const profileId =
    clean(formData.get("staff_id"));

  const isActive =
    clean(formData.get("is_active")) ===
    "true";

  if (!profileId) {
    throw new Error("Kullanıcı ID bulunamadı.");
  }

  if (
    profileId === user.id &&
    !isActive
  ) {
    throw new Error(
      "Kendi hesabınızı pasif yapamazsınız."
    );
  }

  const profile = await getProfile(
    profileId,
    currentProfile.organization_id
  );

  if (
    profile.role === "owner" &&
    !isActive
  ) {
    throw new Error(
      "Sistem Sahibi hesabı pasif yapılamaz."
    );
  }

  const staff = await ensureStaffRecord(
    profileId,
    currentProfile.organization_id
  );

  const { error: profileError } =
    await admin
      .from("profiles")
      .update({
        is_active:
          isActive,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq(
        "organization_id",
        currentProfile.organization_id
      );

  if (profileError) {
    throw new Error(
      `Hesap durumu değiştirilemedi: ${profileError.message}`
    );
  }

  const { error: staffError } =
    await admin
      .from("staff")
      .update({
        is_active:
          isActive,

        login_enabled:
          isActive,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", staff.id);

  if (staffError) {
    throw new Error(
      `Personel durumu değiştirilemedi: ${staffError.message}`
    );
  }

  revalidatePath(PAGE_PATH);
}

/* ============================================================
   ŞİFRE
   ============================================================ */

export async function changeStaffPassword(
  formData: FormData
): Promise<void> {
  const { profile: currentProfile } =
    await requireOwnerOrAdmin();

  const admin = getAdminClient();

  const profileId =
    clean(formData.get("staff_id"));

  const password =
    clean(formData.get("password"));

  if (!profileId) {
    throw new Error("Kullanıcı ID bulunamadı.");
  }

  if (
    !password ||
    password.length < 8
  ) {
    throw new Error(
      "Yeni şifre en az 8 karakter olmalıdır."
    );
  }

  await getProfile(
    profileId,
    currentProfile.organization_id
  );

  const staff = await ensureStaffRecord(
    profileId,
    currentProfile.organization_id
  );

  const { error } =
    await admin.auth.admin.updateUserById(
      profileId,
      {
        password,
      }
    );

  if (error) {
    throw new Error(
      `Şifre değiştirilemedi: ${error.message}`
    );
  }

  await admin
    .from("staff")
    .update({
      must_change_password:
        true,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", staff.id);

  revalidatePath(PAGE_PATH);
}

/* ============================================================
   ŞUBELER
   ============================================================ */

export async function setStaffBranches(
  formData: FormData
): Promise<void> {
  const { profile: currentProfile } =
    await requireOwnerOrAdmin();

  const admin = getAdminClient();

  const profileId =
    clean(formData.get("staff_id"));

  if (!profileId) {
    throw new Error("Kullanıcı ID bulunamadı.");
  }

  const profile = await getProfile(
    profileId,
    currentProfile.organization_id
  );

  if (profile.role === "owner") {
    throw new Error(
      "Sistem Sahibinin şube erişimi sınırlandırılamaz."
    );
  }

  const staff = await ensureStaffRecord(
    profileId,
    currentProfile.organization_id
  );

  let branchIds = [
    ...new Set(
      formData
        .getAll("branch_ids")
        .map(String)
        .filter(Boolean)
    ),
  ];

  const allBranches =
    clean(formData.get("all_branches")) ===
    "true";

  if (allBranches) {
    branchIds = await getAllActiveBranchIds(
      currentProfile.organization_id
    );
  }

  await validateBranches(
    currentProfile.organization_id,
    branchIds
  );

  const { error: deleteError } =
    await admin
      .from("staff_branches")
      .delete()
      .eq(
        "organization_id",
        currentProfile.organization_id
      )
      .eq(
        "staff_id",
        staff.id
      );

  if (deleteError) {
    throw new Error(
      `Eski şube atamaları kaldırılamadı: ${deleteError.message}`
    );
  }

  if (branchIds.length) {
    const rows =
      branchIds.map((branchId) => ({
        organization_id:
          currentProfile.organization_id,

        staff_id:
          staff.id,

        branch_id:
          branchId,
      }));

    const { error } =
      await admin
        .from("staff_branches")
        .insert(rows);

    if (error) {
      throw new Error(
        `Şubeler kaydedilemedi: ${error.message}`
      );
    }
  }

  await admin
    .from("staff")
    .update({
      all_branches:
        allBranches,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", staff.id);

  await admin
    .from("profiles")
    .update({
      branch_id:
        branchIds[0] ?? null,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", profileId);

  revalidatePath(PAGE_PATH);
}

/* ============================================================
   TEK YETKİ
   ============================================================ */

export async function setStaffPermission(
  formData: FormData
): Promise<void> {
  const { profile: currentProfile } =
    await requireOwnerOrAdmin();

  const admin = getAdminClient();

  const profileId =
    clean(formData.get("staff_id"));

  const permissionKey =
    clean(formData.get("permission_key"));

  const isAllowed =
    clean(formData.get("is_allowed")) ===
    "true";

  if (
    !profileId ||
    !permissionKey
  ) {
    throw new Error(
      "Kullanıcı veya yetki bilgisi eksik."
    );
  }

  const profile = await getProfile(
    profileId,
    currentProfile.organization_id
  );

  if (profile.role === "owner") {
    throw new Error(
      "Sistem Sahibinin yetkileri değiştirilemez."
    );
  }

  await validatePermissions([
    permissionKey,
  ]);

  const staff = await ensureStaffRecord(
    profileId,
    currentProfile.organization_id
  );

  const { error } =
    await admin
      .from("staff_permissions")
      .upsert(
        {
          organization_id:
            currentProfile.organization_id,

          staff_id:
            staff.id,

          permission_key:
            permissionKey,

          is_allowed:
            isAllowed,
        },
        {
          onConflict:
            "staff_id,permission_key",
        }
      );

  if (error) {
    throw new Error(
      `Yetki değiştirilemedi: ${error.message}`
    );
  }

  if (
    permissionKey ===
    "system.superuser"
  ) {
    await admin
      .from("staff")
      .update({
        is_super_user:
          isAllowed,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", staff.id);
  }

  revalidatePath(PAGE_PATH);
}

/* ============================================================
   TÜM YETKİLER
   ============================================================ */

export async function setAllStaffPermissions(
  formData: FormData
): Promise<void> {
  const { profile: currentProfile } =
    await requireOwnerOrAdmin();

  const admin = getAdminClient();

  const profileId =
    clean(formData.get("staff_id"));

  const isAllowed =
    clean(formData.get("is_allowed")) ===
    "true";

  if (!profileId) {
    throw new Error("Kullanıcı ID bulunamadı.");
  }

  const profile = await getProfile(
    profileId,
    currentProfile.organization_id
  );

  if (profile.role === "owner") {
    throw new Error(
      "Sistem Sahibinin yetkileri değiştirilemez."
    );
  }

  const staff = await ensureStaffRecord(
    profileId,
    currentProfile.organization_id
  );

  const { data: permissions, error } =
    await admin
      .from("permission_definitions")
      .select("permission_key")
      .eq("is_active", true);

  if (error) {
    throw new Error(
      `Yetkiler alınamadı: ${error.message}`
    );
  }

  if (!permissions?.length) {
    throw new Error(
      "Aktif yetki tanımı bulunamadı."
    );
  }

  const rows =
    permissions.map((permission) => ({
      organization_id:
        currentProfile.organization_id,

      staff_id:
        staff.id,

      permission_key:
        permission.permission_key,

      is_allowed:
        isAllowed,
    }));

  const { error: permissionError } =
    await admin
      .from("staff_permissions")
      .upsert(rows, {
        onConflict:
          "staff_id,permission_key",
      });

  if (permissionError) {
    throw new Error(
      `Yetkiler kaydedilemedi: ${permissionError.message}`
    );
  }

  await admin
    .from("staff")
    .update({
      is_super_user:
        isAllowed,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", staff.id);

  revalidatePath(PAGE_PATH);
}

/* ============================================================
   MUHASEBE
   ============================================================ */

export async function setAccountingPermissions(
  formData: FormData
): Promise<void> {
  const { profile: currentProfile } =
    await requireOwnerOrAdmin();

  const admin = getAdminClient();

  const profileId =
    clean(formData.get("staff_id"));

  const isAllowed =
    clean(formData.get("is_allowed")) ===
    "true";

  if (!profileId) {
    throw new Error("Kullanıcı ID bulunamadı.");
  }

  const profile = await getProfile(
    profileId,
    currentProfile.organization_id
  );

  if (profile.role === "owner") {
    throw new Error(
      "Sistem Sahibinin muhasebe yetkileri değiştirilemez."
    );
  }

  const staff = await ensureStaffRecord(
    profileId,
    currentProfile.organization_id
  );

  const { data: definitions, error } =
    await admin
      .from("permission_definitions")
      .select(
        "permission_key, module_key"
      )
      .eq("is_active", true);

  if (error) {
    throw new Error(
      `Yetkiler alınamadı: ${error.message}`
    );
  }

  const accountingPermissions =
    (definitions ?? []).filter(
      (item) => {
        const moduleKey =
          String(
            item.module_key ?? ""
          ).toLowerCase();

        const permissionKey =
          String(
            item.permission_key ?? ""
          ).toLowerCase();

        return (
          moduleKey.includes("account") ||
          moduleKey.includes("finance") ||
          moduleKey.includes("payment") ||
          moduleKey.includes("cash") ||
          permissionKey.includes("account") ||
          permissionKey.includes("finance") ||
          permissionKey.includes("payment") ||
          permissionKey.includes("cash")
        );
      }
    );

  if (!accountingPermissions.length) {
    throw new Error(
      "Muhasebe, ödeme veya kasa yetkisi bulunamadı."
    );
  }

  const rows =
    accountingPermissions.map(
      (permission) => ({
        organization_id:
          currentProfile.organization_id,

        staff_id:
          staff.id,

        permission_key:
          permission.permission_key,

        is_allowed:
          isAllowed,
      })
    );

  const { error: saveError } =
    await admin
      .from("staff_permissions")
      .upsert(rows, {
        onConflict:
          "staff_id,permission_key",
      });

  if (saveError) {
    throw new Error(
      `Muhasebe yetkileri kaydedilemedi: ${saveError.message}`
    );
  }

  revalidatePath(PAGE_PATH);
}

/* ============================================================
   GİRİŞ MESAJI
   ============================================================ */

export async function generateLoginMessage(
  formData: FormData
) {
  const { profile: currentProfile } =
    await requireOwnerOrAdmin();

  const profileId =
    clean(formData.get("staff_id"));

  const password =
    clean(formData.get("password"));

  if (!profileId) {
    throw new Error("Kullanıcı ID bulunamadı.");
  }

  if (!password) {
    throw new Error(
      "Gönderilecek geçici şifreyi giriniz."
    );
  }

  const profile = await getProfile(
    profileId,
    currentProfile.organization_id
  );

  const login =
    profile.phone ||
    profile.email ||
    "Tanımlı kullanıcı hesabınız";

  const message = `SPRİNT YÜZME OKULU – SprintOS Giriş Bilgileri

Sayın ${profile.full_name || "Personelimiz"},

SprintOS kullanıcı hesabınız oluşturulmuştur.

Kullanıcı Adı / Giriş:
${login}

Geçici Şifreniz:
${password}

GÜVENLİK UYARISI:
Giriş bilgilerinizi ve şifrenizi hiç kimseyle paylaşmayınız. Şifreniz yalnızca size özeldir.

Şüpheli bir giriş veya yetkisiz erişim fark etmeniz halinde Sprint Yüzme Okulu yönetimine bilgi veriniz.

İlk girişinizden sonra şifrenizi değiştirmeniz önerilir.

Sprint Yüzme Okulu Yönetimi`;

  return {
    success: true,
    message,
    phone: profile.phone,
    email: profile.email,
  };
}
