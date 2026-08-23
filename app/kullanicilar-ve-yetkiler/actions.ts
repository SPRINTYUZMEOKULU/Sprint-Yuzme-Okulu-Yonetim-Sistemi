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

export type UserRole = (typeof ALLOWED_ROLES)[number];

export type ActionResult = {
  ok: boolean;
  message: string;
};

export type CreateStaffInput = {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  role: Exclude<UserRole, "owner">;
  branchIds: string[];
  allBranches: boolean;
  permissionKeys: string[];
};

export type UpdateStaffInput = {
  profileId: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: Exclude<UserRole, "owner">;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+90${digits.slice(1)}`;
  if (digits.length === 10) return `+90${digits}`;
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
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Personel", lastName: "-" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY bulunamadı. Vercel Environment Variables bölümüne eklenmelidir."
    );
  }

  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getManager() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Bu işlem için giriş yapmalısınız.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, organization_id, role, is_active, full_name, email")
    .eq("id", user.id)
    .single();

  if (error || !profile) throw new Error("Yönetici profili bulunamadı.");
  if (!profile.is_active) throw new Error("Hesabınız pasif durumda.");
  if (!["owner", "admin"].includes(String(profile.role))) {
    throw new Error("Bu işlem için yönetici yetkisi gerekiyor.");
  }
  if (!profile.organization_id) throw new Error("Organizasyon bilgisi bulunamadı.");

  return { user, profile };
}

async function getProfile(profileId: string, organizationId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, organization_id, branch_id, full_name, email, phone, role, is_active")
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    throw new Error("Kullanıcı bulunamadı veya bu organizasyona ait değil.");
  }
  return data;
}

async function getStaff(profileId: string, organizationId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("staff")
    .select(
      "id, organization_id, auth_user_id, first_name, last_name, phone, email, title, staff_type, is_active, login_enabled, is_super_user, must_change_password, all_branches"
    )
    .eq("organization_id", organizationId)
    .eq("auth_user_id", profileId)
    .maybeSingle();

  if (error) throw new Error(`Personel kaydı okunamadı: ${error.message}`);
  return data;
}

async function ensureStaff(profileId: string, organizationId: string) {
  const existing = await getStaff(profileId, organizationId);
  if (existing) return existing;

  const admin = getAdminClient();
  const profile = await getProfile(profileId, organizationId);
  const { firstName, lastName } = splitName(
    profile.full_name || profile.email || "Personel"
  );

  const { data, error } = await admin
    .from("staff")
    .insert({
      organization_id: organizationId,
      auth_user_id: profileId,
      first_name: firstName,
      last_name: lastName,
      phone: profile.phone || null,
      email: profile.email || null,
      title: roleLabel(String(profile.role)),
      staff_type: String(profile.role || "coach"),
      is_active: Boolean(profile.is_active),
      login_enabled: true,
      is_super_user: profile.role === "owner",
      must_change_password: false,
      all_branches: profile.role === "owner",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Personel kaydı oluşturulamadı: ${error?.message ?? "Bilinmeyen hata"}`
    );
  }
  return data;
}

async function actorStaffId(
  manager: Awaited<ReturnType<typeof getManager>>
) {
  const staff = await ensureStaff(
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
  metadata?: Record<string, unknown>;
  success?: boolean;
}) {
  const admin = getAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    organization_id: params.organizationId,
    actor_profile_id: params.actorProfileId,
    actor_staff_id: params.actorStaffId ?? null,
    module_key: params.moduleKey,
    action_key: params.actionKey,
    action_label: params.actionLabel,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    description: params.description ?? null,
    success: params.success ?? true,
    request_path: PAGE_PATH,
    metadata: params.metadata ?? {},
  });

  if (error) console.error("audit_logs insert error:", error.message);
}

async function validateBranches(organizationId: string, branchIds: string[]) {
  if (!branchIds.length) return;

  const admin = getAdminClient();
  const uniqueIds = [...new Set(branchIds)];
  const { data, error } = await admin
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", uniqueIds);

  if (error) throw new Error(`Şubeler kontrol edilemedi: ${error.message}`);
  if ((data ?? []).length !== uniqueIds.length) {
    throw new Error("Seçilen şubelerden biri bu organizasyona ait değil.");
  }
}

async function getAllActiveBranchIds(organizationId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) throw new Error(`Şubeler alınamadı: ${error.message}`);
  return (data ?? []).map((row) => String(row.id));
}

async function validatePermissions(permissionKeys: string[]) {
  if (!permissionKeys.length) return;

  const admin = getAdminClient();
  const uniqueKeys = [...new Set(permissionKeys)];
  const { data, error } = await admin
    .from("permission_definitions")
    .select("permission_key")
    .eq("is_active", true)
    .in("permission_key", uniqueKeys);

  if (error) throw new Error(`Yetkiler kontrol edilemedi: ${error.message}`);
  if ((data ?? []).length !== uniqueKeys.length) {
    throw new Error("Seçilen yetkilerden biri geçersiz.");
  }
}

function success(message: string): ActionResult {
  return { ok: true, message };
}

function failure(error: unknown): ActionResult {
  const message =
    error instanceof Error ? error.message : "İşlem sırasında beklenmeyen bir hata oluştu.";
  return { ok: false, message };
}

export async function createStaffAction(
  input: CreateStaffInput
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    const fullName = clean(input.fullName);
    const email = normalizeEmail(clean(input.email));
    const phone = normalizePhone(clean(input.phone));
    const password = clean(input.password);
    const role = clean(input.role);

    if (!fullName) throw new Error("Ad soyad zorunludur.");
    if (!email && !phone) throw new Error("Telefon veya e-posta zorunludur.");
    if (password.length < 8) throw new Error("Şifre en az 8 karakter olmalıdır.");
    if (!isAllowedRole(role) || role === "owner") throw new Error("Geçersiz rol.");

    let branchIds = [...new Set(input.branchIds ?? [])];
    if (input.allBranches) {
      branchIds = await getAllActiveBranchIds(manager.profile.organization_id);
    }

    const permissionKeys = [...new Set(input.permissionKeys ?? [])];

    await validateBranches(manager.profile.organization_id, branchIds);
    await validatePermissions(permissionKeys);

    const payload: {
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
        role,
        organization_id: String(manager.profile.organization_id),
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

    const { data: created, error: createError } =
      await admin.auth.admin.createUser(payload);

    if (createError || !created.user) {
      throw new Error(
        `Kullanıcı oluşturulamadı: ${createError?.message ?? "Bilinmeyen hata"}`
      );
    }

    const profileId = created.user.id;
    let createdStaffId: string | null = null;

    try {
      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: profileId,
          organization_id: manager.profile.organization_id,
          branch_id: branchIds[0] ?? null,
          full_name: fullName,
          email: email || null,
          phone: phone || null,
          role,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (profileError) throw new Error(`Profil kaydedilemedi: ${profileError.message}`);

      const { firstName, lastName } = splitName(fullName);
      const superUser = permissionKeys.includes("system.superuser");

      const { data: staffRow, error: staffError } = await admin
        .from("staff")
        .insert({
          organization_id: manager.profile.organization_id,
          auth_user_id: profileId,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          email: email || null,
          title: roleLabel(role),
          staff_type: role,
          is_active: true,
          login_enabled: true,
          is_super_user: superUser,
          must_change_password: true,
          all_branches: Boolean(input.allBranches),
        })
        .select("id")
        .single();

      if (staffError || !staffRow) {
        throw new Error(
          `Personel kaydı oluşturulamadı: ${staffError?.message ?? "Bilinmeyen hata"}`
        );
      }

      createdStaffId = staffRow.id;

      if (branchIds.length) {
        const { error } = await admin.from("staff_branches").insert(
          branchIds.map((branchId) => ({
            organization_id: manager.profile.organization_id,
            staff_id: staffRow.id,
            branch_id: branchId,
          }))
        );
        if (error) throw new Error(`Şubeler kaydedilemedi: ${error.message}`);
      }

      if (permissionKeys.length) {
        const { error } = await admin.from("staff_permissions").insert(
          permissionKeys.map((permissionKey) => ({
            organization_id: manager.profile.organization_id,
            staff_id: staffRow.id,
            permission_key: permissionKey,
            is_allowed: true,
          }))
        );
        if (error) throw new Error(`Yetkiler kaydedilemedi: ${error.message}`);
      }

      await writeAudit({
        organizationId: manager.profile.organization_id,
        actorProfileId: manager.profile.id,
        actorStaffId: await actorStaffId(manager),
        moduleKey: "staff",
        actionKey: "staff.create",
        actionLabel: "Personel oluşturuldu",
        entityType: "profile",
        entityId: profileId,
        description: `${fullName} için ${roleLabel(role)} hesabı oluşturuldu.`,
        metadata: {
          branch_count: branchIds.length,
          permission_count: permissionKeys.length,
        },
      });
    } catch (error) {
      if (createdStaffId) {
        await admin.from("staff").delete().eq("id", createdStaffId);
      }
      await admin.auth.admin.deleteUser(profileId);
      throw error;
    }

    revalidatePath(PAGE_PATH);
    return success("Personel hesabı başarıyla oluşturuldu.");
  } catch (error) {
    return failure(error);
  }
}

export async function updateStaffProfileAction(
  input: UpdateStaffInput
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    const profileId = clean(input.profileId);
    const fullName = clean(input.fullName);
    const email = normalizeEmail(clean(input.email));
    const phone = normalizePhone(clean(input.phone));
    const role = clean(input.role);

    const target = await getProfile(profileId, manager.profile.organization_id);

    if (target.role === "owner") throw new Error("Sistem Sahibi hesabı değiştirilemez.");
    if (!fullName) throw new Error("Ad soyad zorunludur.");
    if (!email && !phone) throw new Error("Telefon veya e-posta zorunludur.");
    if (!isAllowedRole(role) || role === "owner") throw new Error("Geçersiz rol.");

    const attrs: {
      email?: string;
      phone?: string;
      user_metadata: Record<string, string>;
    } = {
      user_metadata: {
        full_name: fullName,
        role,
        organization_id: String(manager.profile.organization_id),
      },
    };

    if (email) attrs.email = email;
    if (phone) attrs.phone = phone;

    const { error: authError } =
      await admin.auth.admin.updateUserById(profileId, attrs);
    if (authError) {
      throw new Error(`Giriş hesabı güncellenemedi: ${authError.message}`);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("organization_id", manager.profile.organization_id);

    if (profileError) throw new Error(`Profil güncellenemedi: ${profileError.message}`);

    const staff = await ensureStaff(profileId, manager.profile.organization_id);
    const { firstName, lastName } = splitName(fullName);

    const { error: staffError } = await admin
      .from("staff")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email || null,
        title: roleLabel(role),
        staff_type: role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    if (staffError) throw new Error(`Personel güncellenemedi: ${staffError.message}`);

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "staff",
      actionKey: "staff.profile.update",
      actionLabel: "Personel bilgileri güncellendi",
      entityType: "profile",
      entityId: profileId,
      description: `${fullName} personel bilgileri güncellendi.`,
    });

    revalidatePath(PAGE_PATH);
    return success("Personel bilgileri kaydedildi.");
  } catch (error) {
    return failure(error);
  }
}

export async function setStaffActiveAction(
  profileId: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    if (profileId === manager.user.id && !active) {
      throw new Error("Kendi hesabınızı pasif yapamazsınız.");
    }

    const target = await getProfile(profileId, manager.profile.organization_id);
    if (target.role === "owner" && !active) {
      throw new Error("Sistem Sahibi pasif yapılamaz.");
    }

    const staff = await ensureStaff(profileId, manager.profile.organization_id);

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        is_active: active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("organization_id", manager.profile.organization_id);

    if (profileError) {
      throw new Error(`Hesap durumu değiştirilemedi: ${profileError.message}`);
    }

    const { error: staffError } = await admin
      .from("staff")
      .update({
        is_active: active,
        login_enabled: active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    if (staffError) {
      throw new Error(`Personel durumu değiştirilemedi: ${staffError.message}`);
    }

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "accounts",
      actionKey: active ? "account.activate" : "account.deactivate",
      actionLabel: active ? "Hesap aktifleştirildi" : "Hesap pasifleştirildi",
      entityType: "profile",
      entityId: profileId,
      description: `${target.full_name || "Kullanıcı"} hesabı ${
        active ? "aktifleştirildi" : "pasifleştirildi"
      }.`,
    });

    revalidatePath(PAGE_PATH);
    return success(active ? "Hesap aktifleştirildi." : "Hesap pasifleştirildi.");
  } catch (error) {
    return failure(error);
  }
}

export async function setLoginEnabledAction(
  profileId: string,
  enabled: boolean
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    const target = await getProfile(profileId, manager.profile.organization_id);
    if (target.role === "owner" && !enabled) {
      throw new Error("Sistem Sahibinin giriş izni kapatılamaz.");
    }

    const staff = await ensureStaff(profileId, manager.profile.organization_id);

    const { error } = await admin
      .from("staff")
      .update({
        login_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    if (error) throw new Error(`Giriş izni değiştirilemedi: ${error.message}`);

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "accounts",
      actionKey: enabled ? "account.login.enable" : "account.login.disable",
      actionLabel: enabled ? "Giriş izni açıldı" : "Giriş izni kapatıldı",
      entityType: "profile",
      entityId: profileId,
      description: `${target.full_name || "Kullanıcı"} için giriş izni ${
        enabled ? "açıldı" : "kapatıldı"
      }.`,
    });

    revalidatePath(PAGE_PATH);
    return success(enabled ? "Sisteme giriş açıldı." : "Sisteme giriş kapatıldı.");
  } catch (error) {
    return failure(error);
  }
}

export async function changeStaffPasswordAction(
  profileId: string,
  password: string
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    if (clean(password).length < 8) {
      throw new Error("Şifre en az 8 karakter olmalıdır.");
    }

    const target = await getProfile(profileId, manager.profile.organization_id);
    const staff = await ensureStaff(profileId, manager.profile.organization_id);

    const { error } = await admin.auth.admin.updateUserById(profileId, {
      password: clean(password),
    });

    if (error) throw new Error(`Şifre değiştirilemedi: ${error.message}`);

    await admin
      .from("staff")
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "accounts",
      actionKey: "account.password.reset",
      actionLabel: "Geçici şifre oluşturuldu",
      entityType: "profile",
      entityId: profileId,
      description: `${target.full_name || "Kullanıcı"} için yeni geçici şifre oluşturuldu.`,
    });

    revalidatePath(PAGE_PATH);
    return success("Yeni şifre başarıyla tanımlandı.");
  } catch (error) {
    return failure(error);
  }
}

export async function setStaffBranchesAction(
  profileId: string,
  branchIds: string[],
  allBranches: boolean
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    const target = await getProfile(profileId, manager.profile.organization_id);
    if (target.role === "owner") {
      throw new Error("Sistem Sahibinin şube erişimi sınırlandırılamaz.");
    }

    const staff = await ensureStaff(profileId, manager.profile.organization_id);

    let nextBranchIds = [...new Set(branchIds ?? [])];
    if (allBranches) {
      nextBranchIds = await getAllActiveBranchIds(manager.profile.organization_id);
    }

    await validateBranches(manager.profile.organization_id, nextBranchIds);

    const { error: deleteError } = await admin
      .from("staff_branches")
      .delete()
      .eq("organization_id", manager.profile.organization_id)
      .eq("staff_id", staff.id);

    if (deleteError) {
      throw new Error(`Eski şubeler kaldırılamadı: ${deleteError.message}`);
    }

    if (nextBranchIds.length) {
      const { error } = await admin.from("staff_branches").insert(
        nextBranchIds.map((branchId) => ({
          organization_id: manager.profile.organization_id,
          staff_id: staff.id,
          branch_id: branchId,
        }))
      );

      if (error) throw new Error(`Şubeler kaydedilemedi: ${error.message}`);
    }

    await admin
      .from("staff")
      .update({
        all_branches: allBranches,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    await admin
      .from("profiles")
      .update({
        branch_id: nextBranchIds[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "branches",
      actionKey: "staff.branches.update",
      actionLabel: "Şube erişimleri güncellendi",
      entityType: "profile",
      entityId: profileId,
      description: `${target.full_name || "Kullanıcı"} için şube erişimleri güncellendi.`,
      metadata: {
        all_branches: allBranches,
        branch_ids: nextBranchIds,
      },
    });

    revalidatePath(PAGE_PATH);
    return success("Şube erişimleri başarıyla kaydedildi.");
  } catch (error) {
    return failure(error);
  }
}

export async function setSuperUserAction(
  profileId: string,
  enabled: boolean
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    const target = await getProfile(profileId, manager.profile.organization_id);
    if (target.role === "owner" && !enabled) {
      throw new Error("Sistem Sahibi Süper Kullanıcıdır.");
    }

    const staff = await ensureStaff(profileId, manager.profile.organization_id);

    const { error: staffError } = await admin
      .from("staff")
      .update({
        is_super_user: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    if (staffError) {
      throw new Error(`Süper Kullanıcı değiştirilemedi: ${staffError.message}`);
    }

    const { error: permissionError } = await admin
      .from("staff_permissions")
      .upsert(
        {
          organization_id: manager.profile.organization_id,
          staff_id: staff.id,
          permission_key: "system.superuser",
          is_allowed: enabled,
        },
        { onConflict: "staff_id,permission_key" }
      );

    if (permissionError) {
      throw new Error(`Süper Kullanıcı yetkisi kaydedilemedi: ${permissionError.message}`);
    }

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "permissions",
      actionKey: enabled
        ? "permissions.superuser.enable"
        : "permissions.superuser.disable",
      actionLabel: enabled ? "Süper Kullanıcı açıldı" : "Süper Kullanıcı kapatıldı",
      entityType: "profile",
      entityId: profileId,
      description: `${target.full_name || "Kullanıcı"} için Süper Kullanıcı ${
        enabled ? "açıldı" : "kapatıldı"
      }.`,
    });

    revalidatePath(PAGE_PATH);
    return success(
      enabled ? "Süper Kullanıcı yetkisi verildi." : "Süper Kullanıcı yetkisi kaldırıldı."
    );
  } catch (error) {
    return failure(error);
  }
}

export async function setStaffPermissionAction(
  profileId: string,
  permissionKey: string,
  allowed: boolean
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    const target = await getProfile(profileId, manager.profile.organization_id);
    if (target.role === "owner") {
      throw new Error("Sistem Sahibinin yetkileri değiştirilemez.");
    }

    await validatePermissions([permissionKey]);
    const staff = await ensureStaff(profileId, manager.profile.organization_id);

    const { error } = await admin.from("staff_permissions").upsert(
      {
        organization_id: manager.profile.organization_id,
        staff_id: staff.id,
        permission_key: permissionKey,
        is_allowed: allowed,
      },
      { onConflict: "staff_id,permission_key" }
    );

    if (error) throw new Error(`Yetki değiştirilemedi: ${error.message}`);

    if (permissionKey === "system.superuser") {
      await admin
        .from("staff")
        .update({
          is_super_user: allowed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", staff.id);
    }

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "permissions",
      actionKey: allowed ? "permission.enable" : "permission.disable",
      actionLabel: allowed ? "Yetki açıldı" : "Yetki kapatıldı",
      entityType: "profile",
      entityId: profileId,
      description: `${target.full_name || "Kullanıcı"} için ${permissionKey} ${
        allowed ? "açıldı" : "kapatıldı"
      }.`,
      metadata: { permission_key: permissionKey, is_allowed: allowed },
    });

    revalidatePath(PAGE_PATH);
    return success(allowed ? "Yetki açıldı." : "Yetki kapatıldı.");
  } catch (error) {
    return failure(error);
  }
}

export async function setAllStaffPermissionsAction(
  profileId: string,
  allowed: boolean
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    const target = await getProfile(profileId, manager.profile.organization_id);
    if (target.role === "owner") {
      throw new Error("Sistem Sahibinin yetkileri değiştirilemez.");
    }

    const staff = await ensureStaff(profileId, manager.profile.organization_id);

    const { data: permissions, error } = await admin
      .from("permission_definitions")
      .select("permission_key")
      .eq("is_active", true);

    if (error) throw new Error(`Yetkiler alınamadı: ${error.message}`);

    const rows = (permissions ?? [])
      .filter((x) => x.permission_key !== "system.superuser")
      .map((x) => ({
        organization_id: manager.profile.organization_id,
        staff_id: staff.id,
        permission_key: x.permission_key,
        is_allowed: allowed,
      }));

    if (rows.length) {
      const { error: saveError } = await admin
        .from("staff_permissions")
        .upsert(rows, { onConflict: "staff_id,permission_key" });

      if (saveError) throw new Error(`Yetkiler kaydedilemedi: ${saveError.message}`);
    }

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "permissions",
      actionKey: allowed ? "permissions.all.enable" : "permissions.all.disable",
      actionLabel: allowed ? "Tüm yetkiler açıldı" : "Tüm yetkiler kapatıldı",
      entityType: "profile",
      entityId: profileId,
      description: `${target.full_name || "Kullanıcı"} için tüm standart yetkiler ${
        allowed ? "açıldı" : "kapatıldı"
      }.`,
    });

    revalidatePath(PAGE_PATH);
    return success(allowed ? "Tüm standart yetkiler açıldı." : "Tüm standart yetkiler kapatıldı.");
  } catch (error) {
    return failure(error);
  }
}

export async function setAccountingPermissionsAction(
  profileId: string,
  allowed: boolean
): Promise<ActionResult> {
  try {
    const manager = await getManager();
    const admin = getAdminClient();

    const target = await getProfile(profileId, manager.profile.organization_id);
    if (target.role === "owner") {
      throw new Error("Sistem Sahibinin muhasebe yetkileri değiştirilemez.");
    }

    const staff = await ensureStaff(profileId, manager.profile.organization_id);

    const { data: defs, error } = await admin
      .from("permission_definitions")
      .select("permission_key, module_key")
      .eq("is_active", true);

    if (error) throw new Error(`Yetkiler alınamadı: ${error.message}`);

    const finance = (defs ?? []).filter((x) => {
      const m = String(x.module_key ?? "").toLowerCase();
      const p = String(x.permission_key ?? "").toLowerCase();
      return (
        m.includes("finance") ||
        m.includes("account") ||
        m.includes("payment") ||
        m.includes("cash") ||
        p.includes("finance") ||
        p.includes("account") ||
        p.includes("payment") ||
        p.includes("cash")
      );
    });

    if (!finance.length) throw new Error("Muhasebe yetkileri bulunamadı.");

    const { error: saveError } = await admin.from("staff_permissions").upsert(
      finance.map((x) => ({
        organization_id: manager.profile.organization_id,
        staff_id: staff.id,
        permission_key: x.permission_key,
        is_allowed: allowed,
      })),
      { onConflict: "staff_id,permission_key" }
    );

    if (saveError) {
      throw new Error(`Muhasebe yetkileri kaydedilemedi: ${saveError.message}`);
    }

    await writeAudit({
      organizationId: manager.profile.organization_id,
      actorProfileId: manager.profile.id,
      actorStaffId: await actorStaffId(manager),
      moduleKey: "finance",
      actionKey: allowed
        ? "finance.permissions.enable"
        : "finance.permissions.disable",
      actionLabel: allowed ? "Muhasebe yetkileri açıldı" : "Muhasebe yetkileri kapatıldı",
      entityType: "profile",
      entityId: profileId,
      description: `${target.full_name || "Kullanıcı"} için muhasebe yetkileri ${
        allowed ? "açıldı" : "kapatıldı"
      }.`,
    });

    revalidatePath(PAGE_PATH);
    return success(allowed ? "Muhasebe erişimi açıldı." : "Muhasebe erişimi kapatıldı.");
  } catch (error) {
    return failure(error);
  }
}
