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

function roleLabel(role: string) {
  const map: Record<string, string> = {
    owner: "Sistem Sahibi",
    admin: "Yönetici",
    branch_manager: "Şube Yöneticisi",
    registration_staff: "Kayıt Personeli",
    accounting: "Muhasebe",
    coach: "Eğitmen",
    guardian: "Veli",
  };

  return map[role] ?? role;
}

function splitName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
  }

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY bulunamadı. Vercel Environment Variables bölümüne eklenmelidir."
    );
  }

  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getManager() {
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
    .select(
      "id, organization_id, role, is_active, full_name, email"
    )
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("Yönetici profili bulunamadı.");
  }

  if (!profile.is_active) {
    throw new Error("Hesabınız pasif durumda.");
  }

  if (
    !["owner", "admin"].includes(
      String(profile.role)
    )
  ) {
    throw new Error(
      "Bu işlem için yönetici yetkisi gerekiyor."
    );
  }

  if (!profile.organization_id) {
    throw new Error(
      "Organizasyon bilgisi bulunamadı."
    );
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
    .eq(
      "organization_id",
      organizationId
    )
    .single();

  if (error || !data) {
    throw new Error(
      "Kullanıcı bulunamadı veya bu organizasyona ait değil."
    );
  }

  return data;
}

async function getStaff(
  profileId: string,
  organizationId: string
) {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("staff")
    .select(
      "id, organization_id, auth_user_id, first_name, last_name, phone, email, title, staff_type, is_active, login_enabled, is_super_user, must_change_password, all_branches"
    )
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "auth_user_id",
      profileId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Personel kaydı okunamadı: ${error.message}`
    );
  }

  return data;
}

async function ensureStaff(
  profileId: string,
  organizationId: string
) {
  const existing =
    await getStaff(
      profileId,
      organizationId
    );

  if (existing) {
    return existing;
  }

  const admin = getAdminClient();

  const profile =
    await getProfile(
      profileId,
      organizationId
    );

  const {
    firstName,
    lastName,
  } = splitName(
    profile.full_name ||
      profile.email ||
      "Personel"
  );

  const { data, error } = await admin
    .from("staff")
    .insert({
      organization_id:
        organizationId,

      auth_user_id:
        profileId,

      first_name:
        firstName,

      last_name:
        lastName,

      phone:
        profile.phone || null,

      email:
        profile.email || null,

      title:
        roleLabel(
          String(profile.role)
        ),

      staff_type:
        String(
          profile.role || "coach"
        ),

      is_active:
        Boolean(profile.is_active),

      login_enabled:
        true,

      is_super_user:
        profile.role === "owner",

      must_change_password:
        false,

      all_branches:
        profile.role === "owner",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Personel kaydı oluşturulamadı: ${
        error?.message ||
        "Bilinmeyen hata"
      }`
    );
  }

  return data;
}

async function actorStaffId(
  manager: Awaited<
    ReturnType<typeof getManager>
  >
) {
  const staff =
    await ensureStaff(
      manager.profile.id,
      manager.profile.organization_id
    );

  return staff.id;
}

async function writeAudit(params: {
  organizationId: string;
  actorProfileId: string;
  actorStaffId?: string | null;

  moduleKey: string;
  actionKey: string;
  actionLabel: string;

  entityType?: string | null;
  entityId?: string | null;

  description?: string | null;

  metadata?: Record<
    string,
    unknown
  >;
}) {
  const admin = getAdminClient();

  const { error } = await admin
    .from("audit_logs")
    .insert({
      organization_id:
        params.organizationId,

      actor_profile_id:
        params.actorProfileId,

      actor_staff_id:
        params.actorStaffId || null,

      module_key:
        params.moduleKey,

      action_key:
        params.actionKey,

      action_label:
        params.actionLabel,

      entity_type:
        params.entityType || null,

      entity_id:
        params.entityId || null,

      description:
        params.description || null,

      success: true,

      request_path:
        PAGE_PATH,

      metadata:
        params.metadata || {},
    });

  if (error) {
    console.error(
      "audit log error:",
      error.message
    );
  }
}

async function validateBranches(
  organizationId: string,
  branchIds: string[]
) {
  if (!branchIds.length) return;

  const admin = getAdminClient();

  const uniqueIds = [
    ...new Set(branchIds),
  ];

  const { data, error } = await admin
    .from("branches")
    .select("id")
    .eq(
      "organization_id",
      organizationId
    )
    .in("id", uniqueIds);

  if (error) {
    throw new Error(
      `Şubeler kontrol edilemedi: ${error.message}`
    );
  }

  if (
    (data || []).length !==
    uniqueIds.length
  ) {
    throw new Error(
      "Geçersiz şube seçimi."
    );
  }
}

async function activeBranchIds(
  organizationId: string
) {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("branches")
    .select("id")
    .eq(
      "organization_id",
      organizationId
    )
    .eq("is_active", true);

  if (error) {
    throw new Error(
      `Şubeler alınamadı: ${error.message}`
    );
  }

  return (data || []).map(
    (item) => String(item.id)
  );
}

async function validatePermissions(
  keys: string[]
) {
  if (!keys.length) return;

  const admin = getAdminClient();

  const uniqueKeys = [
    ...new Set(keys),
  ];

  const { data, error } = await admin
    .from(
      "permission_definitions"
    )
    .select("permission_key")
    .eq("is_active", true)
    .in(
      "permission_key",
      uniqueKeys
    );

  if (error) {
    throw new Error(
      `Yetkiler kontrol edilemedi: ${error.message}`
    );
  }

  if (
    (data || []).length !==
    uniqueKeys.length
  ) {
    throw new Error(
      "Geçersiz yetki seçimi."
    );
  }
}

/* =========================================================
   YENİ KULLANICI
========================================================= */

export async function createStaff(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const fullName = clean(
    formData.get("full_name")
  );

  const email =
    normalizeEmail(
      clean(
        formData.get("email")
      )
    );

  const phone =
    normalizePhone(
      clean(
        formData.get("phone")
      )
    );

  const password = clean(
    formData.get("password")
  );

  const role = clean(
    formData.get("role")
  );

  if (!fullName) {
    throw new Error(
      "Ad soyad zorunludur."
    );
  }

  if (!email && !phone) {
    throw new Error(
      "Telefon veya e-posta zorunludur."
    );
  }

  if (password.length < 8) {
    throw new Error(
      "Şifre en az 8 karakter olmalıdır."
    );
  }

  if (
    !isAllowedRole(role) ||
    role === "owner"
  ) {
    throw new Error(
      "Geçersiz rol seçimi."
    );
  }

  const allBranches =
    clean(
      formData.get(
        "all_branches"
      )
    ) === "true";

  let branchIds = [
    ...new Set(
      formData
        .getAll(
          "branch_ids"
        )
        .map(String)
        .filter(Boolean)
    ),
  ];

  if (allBranches) {
    branchIds =
      await activeBranchIds(
        manager.profile
          .organization_id
      );
  }

  const permissionKeys = [
    ...new Set(
      formData
        .getAll(
          "permission_keys"
        )
        .map(String)
        .filter(Boolean)
    ),
  ];

  await validateBranches(
    manager.profile.organization_id,
    branchIds
  );

  await validatePermissions(
    permissionKeys
  );

  const payload: {
    email?: string;
    phone?: string;
    password: string;
    email_confirm?: boolean;
    phone_confirm?: boolean;
    user_metadata: Record<
      string,
      string
    >;
  } = {
    password,

    user_metadata: {
      full_name:
        fullName,

      role,

      organization_id:
        String(
          manager.profile
            .organization_id
        ),
    },
  };

  if (email) {
    payload.email = email;
    payload.email_confirm = true;
  }

  if (phone) {
    payload.phone = phone;
    payload.phone_confirm = true;
  }

  const {
    data: authData,
    error: authError,
  } =
    await admin.auth.admin.createUser(
      payload
    );

  if (
    authError ||
    !authData.user
  ) {
    throw new Error(
      `Kullanıcı oluşturulamadı: ${
        authError?.message ||
        "Bilinmeyen hata"
      }`
    );
  }

  const profileId =
    authData.user.id;

  let createdStaffId:
    | string
    | null = null;

  try {
    const {
      error: profileError,
    } = await admin
      .from("profiles")
      .upsert(
        {
          id:
            profileId,

          organization_id:
            manager.profile
              .organization_id,

          branch_id:
            branchIds[0] ||
            null,

          full_name:
            fullName,

          email:
            email || null,

          phone:
            phone || null,

          role,

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

    const {
      firstName,
      lastName,
    } = splitName(
      fullName
    );

    const superUser =
      permissionKeys.includes(
        "system.superuser"
      );

    const {
      data: staff,
      error: staffError,
    } = await admin
      .from("staff")
      .insert({
        organization_id:
          manager.profile
            .organization_id,

        auth_user_id:
          profileId,

        first_name:
          firstName,

        last_name:
          lastName,

        phone:
          phone || null,

        email:
          email || null,

        title:
          roleLabel(role),

        staff_type:
          role,

        is_active:
          true,

        login_enabled:
          true,

        is_super_user:
          superUser,

        must_change_password:
          true,

        all_branches:
          allBranches,
      })
      .select("id")
      .single();

    if (
      staffError ||
      !staff
    ) {
      throw new Error(
        `Personel kaydı oluşturulamadı: ${
          staffError?.message ||
          "Bilinmeyen hata"
        }`
      );
    }

    createdStaffId =
      staff.id;

    if (branchIds.length) {
      const { error } =
        await admin
          .from(
            "staff_branches"
          )
          .insert(
            branchIds.map(
              (branchId) => ({
                organization_id:
                  manager.profile
                    .organization_id,

                staff_id:
                  staff.id,

                branch_id:
                  branchId,
              })
            )
          );

      if (error) {
        throw new Error(
          `Şubeler kaydedilemedi: ${error.message}`
        );
      }
    }

    if (
      permissionKeys.length
    ) {
      const { error } =
        await admin
          .from(
            "staff_permissions"
          )
          .insert(
            permissionKeys.map(
              (
                permissionKey
              ) => ({
                organization_id:
                  manager.profile
                    .organization_id,

                staff_id:
                  staff.id,

                permission_key:
                  permissionKey,

                is_allowed:
                  true,
              })
            )
          );

      if (error) {
        throw new Error(
          `Yetkiler kaydedilemedi: ${error.message}`
        );
      }
    }

    await writeAudit({
      organizationId:
        manager.profile
          .organization_id,

      actorProfileId:
        manager.profile.id,

      actorStaffId:
        await actorStaffId(
          manager
        ),

      moduleKey: "staff",

      actionKey:
        "staff.create",

      actionLabel:
        "Personel oluşturuldu",

      entityType:
        "profile",

      entityId:
        profileId,

      description:
        `${fullName} için ${roleLabel(
          role
        )} hesabı oluşturuldu.`,

      metadata: {
        role,
        branch_count:
          branchIds.length,
        permission_count:
          permissionKeys.length,
      },
    });
  } catch (error) {
    if (createdStaffId) {
      await admin
        .from("staff")
        .delete()
        .eq(
          "id",
          createdStaffId
        );
    }

    await admin.auth.admin.deleteUser(
      profileId
    );

    throw error;
  }

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   PROFİL
========================================================= */

export async function updateStaffProfile(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  if (
    target.role === "owner"
  ) {
    throw new Error(
      "Sistem Sahibi hesabı değiştirilemez."
    );
  }

  const fullName = clean(
    formData.get("full_name")
  );

  const email =
    normalizeEmail(
      clean(
        formData.get("email")
      )
    );

  const phone =
    normalizePhone(
      clean(
        formData.get("phone")
      )
    );

  const role = clean(
    formData.get("role")
  );

  if (!fullName) {
    throw new Error(
      "Ad soyad zorunludur."
    );
  }

  if (!email && !phone) {
    throw new Error(
      "Telefon veya e-posta zorunludur."
    );
  }

  if (
    !isAllowedRole(role) ||
    role === "owner"
  ) {
    throw new Error(
      "Geçersiz rol."
    );
  }

  const attributes: {
    email?: string;
    phone?: string;

    user_metadata: Record<
      string,
      string
    >;
  } = {
    user_metadata: {
      full_name:
        fullName,

      role,

      organization_id:
        String(
          manager.profile
            .organization_id
        ),
    },
  };

  if (email) {
    attributes.email =
      email;
  }

  if (phone) {
    attributes.phone =
      phone;
  }

  const {
    error: authError,
  } =
    await admin.auth.admin.updateUserById(
      profileId,
      attributes
    );

  if (authError) {
    throw new Error(
      `Giriş hesabı güncellenemedi: ${authError.message}`
    );
  }

  const {
    error: profileError,
  } = await admin
    .from("profiles")
    .update({
      full_name:
        fullName,

      email:
        email || null,

      phone:
        phone || null,

      role,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", profileId)
    .eq(
      "organization_id",
      manager.profile
        .organization_id
    );

  if (profileError) {
    throw new Error(
      `Profil güncellenemedi: ${profileError.message}`
    );
  }

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
    );

  const {
    firstName,
    lastName,
  } = splitName(
    fullName
  );

  const {
    error: staffError,
  } = await admin
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
        roleLabel(role),

      staff_type:
        role,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      staff.id
    );

  if (staffError) {
    throw new Error(
      `Personel güncellenemedi: ${staffError.message}`
    );
  }

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey: "staff",

    actionKey:
      "staff.profile.update",

    actionLabel:
      "Personel bilgileri güncellendi",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${fullName} personel bilgileri güncellendi.`,
  });

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   HESAP DURUMU
========================================================= */

export async function setStaffActive(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const active =
    clean(
      formData.get(
        "is_active"
      )
    ) === "true";

  if (
    profileId ===
      manager.user.id &&
    !active
  ) {
    throw new Error(
      "Kendi hesabınızı pasif yapamazsınız."
    );
  }

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  if (
    target.role === "owner" &&
    !active
  ) {
    throw new Error(
      "Sistem Sahibi pasif yapılamaz."
    );
  }

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
    );

  const { error } =
    await admin
      .from("profiles")
      .update({
        is_active:
          active,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", profileId);

  if (error) {
    throw new Error(
      `Hesap durumu değiştirilemedi: ${error.message}`
    );
  }

  await admin
    .from("staff")
    .update({
      is_active:
        active,

      login_enabled:
        active,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      staff.id
    );

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey:
      "accounts",

    actionKey:
      active
        ? "account.activate"
        : "account.deactivate",

    actionLabel:
      active
        ? "Hesap aktifleştirildi"
        : "Hesap pasifleştirildi",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${
        target.full_name ||
        "Kullanıcı"
      } hesabı ${
        active
          ? "aktifleştirildi"
          : "pasifleştirildi"
      }.`,
  });

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   GİRİŞ İZNİ
========================================================= */

export async function setLoginEnabled(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const enabled =
    clean(
      formData.get(
        "login_enabled"
      )
    ) === "true";

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  if (
    target.role === "owner" &&
    !enabled
  ) {
    throw new Error(
      "Sistem Sahibinin girişi kapatılamaz."
    );
  }

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
    );

  const { error } =
    await admin
      .from("staff")
      .update({
        login_enabled:
          enabled,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        staff.id
      );

  if (error) {
    throw new Error(
      `Giriş izni değiştirilemedi: ${error.message}`
    );
  }

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey:
      "accounts",

    actionKey:
      enabled
        ? "account.login.enable"
        : "account.login.disable",

    actionLabel:
      enabled
        ? "Giriş izni açıldı"
        : "Giriş izni kapatıldı",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${
        target.full_name ||
        "Kullanıcı"
      } için giriş izni ${
        enabled
          ? "açıldı"
          : "kapatıldı"
      }.`,
  });

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   ŞİFRE
========================================================= */

export async function changeStaffPassword(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const password = clean(
    formData.get("password")
  );

  if (
    password.length < 8
  ) {
    throw new Error(
      "Şifre en az 8 karakter olmalıdır."
    );
  }

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
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
    .eq(
      "id",
      staff.id
    );

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey:
      "accounts",

    actionKey:
      "account.password.reset",

    actionLabel:
      "Geçici şifre oluşturuldu",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${
        target.full_name ||
        "Kullanıcı"
      } için yeni geçici şifre oluşturuldu.`,
  });

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   ŞUBELER
========================================================= */

export async function setStaffBranches(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  if (
    target.role === "owner"
  ) {
    throw new Error(
      "Sistem Sahibinin şube erişimi sınırlandırılamaz."
    );
  }

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
    );

  const allBranches =
    clean(
      formData.get(
        "all_branches"
      )
    ) === "true";

  let branchIds = [
    ...new Set(
      formData
        .getAll(
          "branch_ids"
        )
        .map(String)
        .filter(Boolean)
    ),
  ];

  if (allBranches) {
    branchIds =
      await activeBranchIds(
        manager.profile
          .organization_id
      );
  }

  await validateBranches(
    manager.profile.organization_id,
    branchIds
  );

  const {
    error: deleteError,
  } = await admin
    .from("staff_branches")
    .delete()
    .eq(
      "organization_id",
      manager.profile
        .organization_id
    )
    .eq(
      "staff_id",
      staff.id
    );

  if (deleteError) {
    throw new Error(
      `Eski şubeler kaldırılamadı: ${deleteError.message}`
    );
  }

  if (branchIds.length) {
    const { error } =
      await admin
        .from(
          "staff_branches"
        )
        .insert(
          branchIds.map(
            (branchId) => ({
              organization_id:
                manager.profile
                  .organization_id,

              staff_id:
                staff.id,

              branch_id:
                branchId,
            })
          )
        );

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
    .eq(
      "id",
      staff.id
    );

  await admin
    .from("profiles")
    .update({
      branch_id:
        branchIds[0] ||
        null,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      profileId
    );

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey:
      "branches",

    actionKey:
      "staff.branches.update",

    actionLabel:
      "Şube erişimleri güncellendi",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${
        target.full_name ||
        "Kullanıcı"
      } için şube erişimleri güncellendi.`,

    metadata: {
      all_branches:
        allBranches,

      branch_ids:
        branchIds,
    },
  });

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   SÜPER KULLANICI
========================================================= */

export async function setSuperUser(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const enabled =
    clean(
      formData.get(
        "is_super_user"
      )
    ) === "true";

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  if (
    target.role === "owner" &&
    !enabled
  ) {
    throw new Error(
      "Sistem Sahibi Süper Kullanıcıdır."
    );
  }

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
    );

  const { error } =
    await admin
      .from("staff")
      .update({
        is_super_user:
          enabled,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        staff.id
      );

  if (error) {
    throw new Error(
      `Süper Kullanıcı değiştirilemedi: ${error.message}`
    );
  }

  await admin
    .from(
      "staff_permissions"
    )
    .upsert(
      {
        organization_id:
          manager.profile
            .organization_id,

        staff_id:
          staff.id,

        permission_key:
          "system.superuser",

        is_allowed:
          enabled,
      },
      {
        onConflict:
          "staff_id,permission_key",
      }
    );

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey:
      "permissions",

    actionKey:
      enabled
        ? "permissions.superuser.enable"
        : "permissions.superuser.disable",

    actionLabel:
      enabled
        ? "Süper Kullanıcı açıldı"
        : "Süper Kullanıcı kapatıldı",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${
        target.full_name ||
        "Kullanıcı"
      } için Süper Kullanıcı ${
        enabled
          ? "açıldı"
          : "kapatıldı"
      }.`,
  });

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   TEK YETKİ
========================================================= */

export async function setStaffPermission(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const permissionKey = clean(
    formData.get(
      "permission_key"
    )
  );

  const allowed =
    clean(
      formData.get(
        "is_allowed"
      )
    ) === "true";

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  if (
    target.role === "owner"
  ) {
    throw new Error(
      "Sistem Sahibinin yetkileri değiştirilemez."
    );
  }

  await validatePermissions([
    permissionKey,
  ]);

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
    );

  const { error } =
    await admin
      .from(
        "staff_permissions"
      )
      .upsert(
        {
          organization_id:
            manager.profile
              .organization_id,

          staff_id:
            staff.id,

          permission_key:
            permissionKey,

          is_allowed:
            allowed,
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
          allowed,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        staff.id
      );
  }

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey:
      "permissions",

    actionKey:
      allowed
        ? "permission.enable"
        : "permission.disable",

    actionLabel:
      allowed
        ? "Yetki açıldı"
        : "Yetki kapatıldı",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${
        target.full_name ||
        "Kullanıcı"
      } için ${permissionKey} ${
        allowed
          ? "açıldı"
          : "kapatıldı"
      }.`,
  });

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   TÜM YETKİLER
========================================================= */

export async function setAllStaffPermissions(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const allowed =
    clean(
      formData.get(
        "is_allowed"
      )
    ) === "true";

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  if (
    target.role === "owner"
  ) {
    throw new Error(
      "Sistem Sahibinin yetkileri değiştirilemez."
    );
  }

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
    );

  const { data, error } =
    await admin
      .from(
        "permission_definitions"
      )
      .select(
        "permission_key"
      )
      .eq("is_active", true);

  if (error) {
    throw new Error(
      `Yetkiler alınamadı: ${error.message}`
    );
  }

  const rows = (
    data || []
  )
    .filter(
      (item) =>
        item.permission_key !==
        "system.superuser"
    )
    .map((item) => ({
      organization_id:
        manager.profile
          .organization_id,

      staff_id:
        staff.id,

      permission_key:
        item.permission_key,

      is_allowed:
        allowed,
    }));

  if (rows.length) {
    const { error } =
      await admin
        .from(
          "staff_permissions"
        )
        .upsert(rows, {
          onConflict:
            "staff_id,permission_key",
        });

    if (error) {
      throw new Error(
        `Yetkiler kaydedilemedi: ${error.message}`
      );
    }
  }

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey:
      "permissions",

    actionKey:
      allowed
        ? "permissions.all.enable"
        : "permissions.all.disable",

    actionLabel:
      allowed
        ? "Tüm yetkiler açıldı"
        : "Tüm yetkiler kapatıldı",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${
        target.full_name ||
        "Kullanıcı"
      } için tüm standart yetkiler ${
        allowed
          ? "açıldı"
          : "kapatıldı"
      }.`,
  });

  revalidatePath(PAGE_PATH);
}

/* =========================================================
   MUHASEBE
========================================================= */

export async function setAccountingPermissions(
  formData: FormData
): Promise<void> {
  const manager =
    await getManager();

  const admin =
    getAdminClient();

  const profileId = clean(
    formData.get("staff_id")
  );

  const allowed =
    clean(
      formData.get(
        "is_allowed"
      )
    ) === "true";

  const target =
    await getProfile(
      profileId,
      manager.profile
        .organization_id
    );

  if (
    target.role === "owner"
  ) {
    throw new Error(
      "Sistem Sahibinin muhasebe yetkileri değiştirilemez."
    );
  }

  const staff =
    await ensureStaff(
      profileId,
      manager.profile
        .organization_id
    );

  const { data, error } =
    await admin
      .from(
        "permission_definitions"
      )
      .select(
        "permission_key, module_key"
      )
      .eq("is_active", true);

  if (error) {
    throw new Error(
      `Yetkiler alınamadı: ${error.message}`
    );
  }

  const finance = (
    data || []
  ).filter((item) => {
    const moduleKey =
      String(
        item.module_key || ""
      ).toLowerCase();

    const permissionKey =
      String(
        item.permission_key ||
          ""
      ).toLowerCase();

    return (
      moduleKey.includes(
        "finance"
      ) ||
      moduleKey.includes(
        "account"
      ) ||
      moduleKey.includes(
        "payment"
      ) ||
      moduleKey.includes(
        "cash"
      ) ||
      permissionKey.includes(
        "finance"
      ) ||
      permissionKey.includes(
        "account"
      ) ||
      permissionKey.includes(
        "payment"
      ) ||
      permissionKey.includes(
        "cash"
      )
    );
  });

  if (!finance.length) {
    throw new Error(
      "Muhasebe yetkileri bulunamadı."
    );
  }

  const { error: saveError } =
    await admin
      .from(
        "staff_permissions"
      )
      .upsert(
        finance.map(
          (item) => ({
            organization_id:
              manager.profile
                .organization_id,

            staff_id:
              staff.id,

            permission_key:
              item.permission_key,

            is_allowed:
              allowed,
          })
        ),
        {
          onConflict:
            "staff_id,permission_key",
        }
      );

  if (saveError) {
    throw new Error(
      `Muhasebe yetkileri kaydedilemedi: ${saveError.message}`
    );
  }

  await writeAudit({
    organizationId:
      manager.profile
        .organization_id,

    actorProfileId:
      manager.profile.id,

    actorStaffId:
      await actorStaffId(
        manager
      ),

    moduleKey:
      "finance",

    actionKey:
      allowed
        ? "finance.permissions.enable"
        : "finance.permissions.disable",

    actionLabel:
      allowed
        ? "Muhasebe yetkileri açıldı"
        : "Muhasebe yetkileri kapatıldı",

    entityType:
      "profile",

    entityId:
      profileId,

    description:
      `${
        target.full_name ||
        "Kullanıcı"
      } için muhasebe yetkileri ${
        allowed
          ? "açıldı"
          : "kapatıldı"
      }.`,
  });

  revalidatePath(PAGE_PATH);
}
