"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { portalCredentialContact, savePortalCredential } from "../portal-credential-actions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normalizePortalPhone, resolvePortalRecipient } from "@/lib/guardian/portal-recipient";
import { createClient as createScopedClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/profile";

const roles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

export type GuardianBulkResult = {
  ok: boolean;
  key: string;
  fullName: string;
  phone: string;
  email: string;
  password?: string;
  accountId?: string;
  revision?: string;
  studentNames: string[];
  status: "created" | "linked" | "password_reset" | "error";
  message: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function phoneCandidates(phone: string) {
  const local = phone.replace(/^\+90/, "");
  return [phone, `90${local}`, `0${local}`, local];
}

function temporaryPassword() {
  return `Sp-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}-A9!`;
}

export async function prepareGuardianAccountBatch(studentIds: string[], resetExisting = false) {
  return prepareGuardianAccounts(studentIds, resetExisting);
}

export async function addSecondaryGuardian(formData: FormData) {
  const studentId = String(formData.get("student_id") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim().slice(0, 120);
  const phone = normalizePortalPhone(formData.get("phone"));
  const path = `/veliler/ogrenci/${encodeURIComponent(studentId)}`;
  if (!studentId || !fullName || !phone) redirect(`${path}?error=${encodeURIComponent("İkinci velinin adını ve geçerli cep telefonunu girin.")}`);
  await requireProfile([...roles]);
  const scoped = await createScopedClient();
  const { data: student, error } = await scoped.from("students").select("id").eq("id", studentId).eq("is_deleted", false).maybeSingle();
  if (error || !student) redirect(`${path}?error=${encodeURIComponent("Kursiyer bulunamadı veya işlem yetkiniz yok.")}`);
  const [result] = await prepareGuardianAccounts([studentId], false, { fullName, phone });
  if (!result?.ok || !result.accountId) redirect(`${path}?error=${encodeURIComponent(result?.message || "İkinci veli bağlanamadı.")}`);
  revalidatePath(path);
  redirect(`/veliler/${encodeURIComponent(result.accountId)}?student=${encodeURIComponent(studentId)}`);
}

async function prepareGuardianAccounts(studentIdsValue: string[], resetExisting: boolean, secondary?: { fullName: string; phone: string }): Promise<GuardianBulkResult[]> {
  const profile = await requireProfile([...roles]);
  const organizationId = profile.organization_id;
  const studentIds = [...new Set((studentIdsValue || []).map(String).map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (!organizationId || !studentIds.length) return [];

  const admin = adminClient();
  const { data: students, error: studentError } = await admin
    .from("students")
    .select("id,first_name,last_name,phone,guardian_name,guardian_phone,guardian_email,preferred_group_id")
    .eq("organization_id", organizationId)
    .eq("is_deleted", false)
    .in("id", studentIds);

  if (studentError) {
    return [{ ok: false, key: "batch", fullName: "", phone: "", email: "", studentNames: [], status: "error", message: studentError.message }];
  }

  const groupIds = [...new Set((students || []).map((student: any) => student.preferred_group_id).filter(Boolean))];
  const { data: groupRows } = groupIds.length
    ? await admin.from("training_groups").select("id,name,course_type").eq("organization_id", organizationId).in("id", groupIds)
    : { data: [] as any[] };
  const groupMap = new Map((groupRows || []).map((group: any) => [group.id, group]));

  const linkedResults = new Map<string, GuardianBulkResult>();
  const unlinkedStudents: any[] = [];
  const {data:existingLinks,error:linksError}=await admin.from("guardian_students").select("student_id,guardian_id,is_primary,portal_access").in("student_id",studentIds);
  if(linksError) return [{ok:false,key:"links",fullName:"",phone:"",email:"",studentNames:[],status:"error",message:"Mevcut hesap bağlantıları okunamadı. Şifreler değiştirilmedi."}];
  const guardianIds=[...new Set((existingLinks||[]).map(link=>link.guardian_id))];
  const {data:linkedRecords,error:recordsError}=guardianIds.length
    ?await admin.from("guardians").select("id,auth_user_id,phone,is_active,login_enabled").eq("organization_id",organizationId).in("id",guardianIds)
    :{data:[],error:null};
  if(recordsError)return [{ok:false,key:"links",fullName:"",phone:"",email:"",studentNames:[],status:"error",message:"Veli kayıtları okunamadı. İşlem yapılmadı."}];
  if (secondary && !(students?.length === 1 && existingLinks?.some(link =>
    link.student_id === students[0].id && link.is_primary && link.portal_access &&
    linkedRecords?.some(record => record.id === link.guardian_id && record.auth_user_id)
  ))) {
    return [{ ok: false, key: "secondary", fullName: secondary.fullName, phone: secondary.phone, email: "", studentNames: [], status: "error", message: "Önce kursiyerin birincil portal hesabını hazırlayın." }];
  }
  const pendingRecords=new Map<string,any>();
  for(const student of students || []) {
    if (secondary) { unlinkedStudents.push(student); continue; }
    if(!existingLinks?.some(link=>link.student_id===student.id)){unlinkedStudents.push(student);continue;}
    const links=existingLinks!.filter(link=>link.student_id===student.id);
    const records=links.map(link=>linkedRecords?.find(record=>record.id===link.guardian_id));
    if(records.every(record=>record&&!record.auth_user_id)&&records.length===1&&records[0]?.is_active!==false&&records[0]?.login_enabled!==false){
      const group:any=groupMap.get(student.preferred_group_id);
      const phone=resolvePortalRecipient(student, group).phone;
      const storedPhone=normalizePortalPhone(records[0]?.phone);
      if(!storedPhone||storedPhone===phone){pendingRecords.set(student.id,records[0]);unlinkedStudents.push(student);continue;}
    }
    const contact=await portalCredentialContact({studentId:student.id});
    const studentName=`${student.first_name || ""} ${student.last_name || ""}`.trim();
    if(!contact.ok){linkedResults.set(student.id,{ok:false,key:student.id,fullName:studentName,phone:"",email:"",studentNames:[studentName],status:"error",message:contact.message});continue;}
    const previous=linkedResults.get(contact.accountId);
    if(previous){previous.studentNames.push(studentName);continue;}
    const saved=resetExisting?await savePortalCredential({accountId:contact.accountId},temporaryPassword()):null;
    linkedResults.set(contact.accountId,{ok:!saved || saved.ok,key:contact.accountId,accountId:contact.accountId,revision:saved?.ok?saved.revision:contact.revision,fullName:contact.fullName,phone:contact.phone,email:contact.email,password:saved?.ok?saved.password:undefined,studentNames:[studentName],status:saved?.ok?"password_reset":"linked",message:saved?saved.message:"Mevcut hesap bağlı; şifre değiştirilmedi."});
  }
  const groups = new Map<string, { fullName: string; phone: string; email: string; relationship: string; students: any[] }>();
  for (const student of unlinkedStudents) {
    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const { fullName, phone, email, relationship, error } = secondary ? { ...secondary, email: "", relationship: "Veli", error: "" } : resolvePortalRecipient(student, groupMap.get(student.preferred_group_id));
    if (error) {
      linkedResults.set(student.id, { ok: false, key: student.id, fullName, phone, email, studentNames: [studentName], status: "error", message: error });
      continue;
    }
    const current = groups.get(phone);
    if (current) current.students.push(student);
    else groups.set(phone, { fullName, phone, email, relationship, students: [student] });
  }

  const results: GuardianBulkResult[] = [...linkedResults.values()];
  for (const [key, group] of groups) {
    const candidates = phoneCandidates(group.phone);
    const studentNames = group.students.map((student) => `${student.first_name || ""} ${student.last_name || ""}`.trim());
    const password = temporaryPassword();
    let created = false;
    try {
      const pending=[...new Map(group.students.map(student=>pendingRecords.get(student.id)).filter(Boolean).map(record=>[record.id,record])).values()];
      if(pending.length>1)throw new Error("Aynı telefon birden fazla veli kaydına bağlı. Veli merkezinden bağlantıları kontrol edin.");
      const pendingRecord:any=pending[0]||null;
      const { data: existingProfile, error: lookupError } = await admin.from("profiles").select("id,full_name,phone,email,is_active").eq("organization_id", organizationId).eq("role", "guardian").in("phone", candidates).limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      if (secondary && existingProfile && !existingProfile.is_active) throw new Error("Bu velinin portal hesabı pasif. Erişim durumunu Veli Merkezi’nden kontrol edin.");
      if (secondary && linkedRecords?.some(record => normalizePortalPhone(record.phone) === group.phone || (existingProfile && record.auth_user_id === existingProfile.id))) {
        throw new Error("Bu telefon zaten kursiyere bağlı bir veli hesabında kullanılıyor.");
      }
      let authUserId = existingProfile?.id || "";
      if (!authUserId) {
        const payload: any = { phone: group.phone, phone_confirm: true, password, user_metadata: { full_name: group.fullName, role: "guardian", organization_id: organizationId } };
        if (group.email || secondary) {
          payload.email = group.email || `phone.${group.phone.slice(3)}@login.sprintos.local`;
          payload.email_confirm = true;
        }
        const { data: createdUser, error: createError } = await admin.auth.admin.createUser(payload);
        if (createError || !createdUser.user) throw createError || new Error("Portal giriş hesabı oluşturulamadı.");
        authUserId = createdUser.user.id;
        created = true;
      } else {
        const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(authUserId);
        if (authLookupError || !authData.user) throw authLookupError || new Error("Portal kimlik hesabı bulunamadı.");

      }

      if (!secondary || created) {
        const { error: profileError } = await admin.from("profiles").upsert({ id: authUserId, organization_id: organizationId, full_name: existingProfile?.full_name || group.fullName, phone: group.phone, email: existingProfile?.email || group.email || null, role: "guardian", is_active: true, updated_at: new Date().toISOString() }, { onConflict: "id" });
        if (profileError) throw profileError;
      }

      let guardianRecord: any = null;
      const { data: byAuth } = await admin.from("guardians").select("id,auth_user_id,is_active,login_enabled").eq("organization_id", organizationId).eq("auth_user_id", authUserId).limit(1).maybeSingle();
      if(byAuth&&pendingRecord&&byAuth.id!==pendingRecord.id)throw new Error("Mevcut giriş hesabı başka bir veli kaydına bağlı. Veli merkezinden kontrol edin.");
      guardianRecord = byAuth||pendingRecord;
      if (!guardianRecord) {
        const { data: byPhone } = await admin.from("guardians").select("id,auth_user_id,is_active,login_enabled").eq("organization_id", organizationId).in("phone", candidates).limit(1).maybeSingle();
        guardianRecord = byPhone;
      }
      if (guardianRecord?.auth_user_id && guardianRecord.auth_user_id !== authUserId) throw new Error("Telefon başka bir portal hesabına bağlı. Veli merkezinde bağlantıyı kontrol edin.");
      if (secondary && guardianRecord && (guardianRecord.is_active === false || guardianRecord.login_enabled === false)) {
        throw new Error("Bu velinin portal erişimi kapalı. Erişimi Veli Merkezi’nden kontrol edin.");
      }
      if (guardianRecord && !(secondary && guardianRecord.auth_user_id)) {
        const { error } = await admin.from("guardians").update({ auth_user_id: authUserId, full_name: group.fullName, phone: group.phone, email: group.email || null, relationship: group.relationship, login_enabled: true, is_active: true, first_login_required: true, updated_at: new Date().toISOString() }).eq("id", guardianRecord.id).eq("organization_id", organizationId);
        if (error) throw error;
      } else if (!guardianRecord) {
        const { data: inserted, error } = await admin.from("guardians").insert({ organization_id: organizationId, auth_user_id: authUserId, full_name: group.fullName, phone: group.phone, email: group.email || null, relationship: group.relationship, login_enabled: true, is_active: true, first_login_required: true, portal_created_at: new Date().toISOString() }).select("id").single();
        if (error || !inserted) throw error || new Error("Portal kişi kaydı oluşturulamadı.");
        guardianRecord = inserted;
      }

      for (const student of group.students) {
        // Keep additional guardian links, but guarantee one primary account per student.
        if (!secondary) {
          const { error: primaryError } = await admin.from("guardian_students")
            .update({ is_primary: false })
            .eq("student_id", student.id)
            .eq("is_primary", true)
            .neq("guardian_id", guardianRecord.id);
          if (primaryError) throw primaryError;
        }
        const { error: linkError } = await admin.from("guardian_students").upsert({ guardian_id: guardianRecord.id, student_id: student.id, relationship: group.relationship, is_primary: !secondary, is_payment_contact: !secondary, receives_messages: !secondary, portal_access: true }, { onConflict: "guardian_id,student_id", ignoreDuplicates: Boolean(secondary) });
        if (linkError) throw linkError;
        const selfAccount = group.relationship === "Kendisi";
        await admin.from("student_activity_logs").insert({ organization_id: organizationId, student_id: student.id, activity_type: created ? (selfAccount ? "student_self_portal_bulk_created" : "guardian_portal_bulk_created") : "guardian_portal_linked", title: created ? (selfAccount ? "Kursiyer portal hesabı toplu işlemle oluşturuldu" : "Veli portal hesabı toplu işlemle oluşturuldu") : "Portal hesabı bağlandı", description: `${group.fullName} için giriş bilgileri Veli / Kursiyer Portal Merkezi üzerinden hazırlandı.`, source_type: "guardian_bulk_accounts", source_id: authUserId, performed_at: new Date().toISOString() });
      }

      const contact=await portalCredentialContact({accountId:authUserId});
      if(!contact.ok)throw new Error(contact.message);
      const saved=!created && resetExisting?await savePortalCredential({accountId:authUserId},password):null;
      if(saved && !saved.ok)throw new Error(saved.message);
      const sharedPassword=created?password:saved?.ok?saved.password:undefined;
      const selfAccount = group.relationship === "Kendisi";
      results.push({ ok: true, key, fullName: group.fullName, phone: group.phone, email: group.email, password:sharedPassword, accountId:authUserId, revision:saved?.ok?saved.revision:contact.revision, studentNames, status: created ? "created" : sharedPassword ? "password_reset" : "linked", message: created ? (selfAccount ? "Kursiyer portal hesabı oluşturuldu ve şifresi hazırlandı." : "Veli portal hesabı oluşturuldu ve şifresi hazırlandı.") : sharedPassword ? "Yeni geçici şifre hazırlandı." : "Mevcut hesap bağlandı. Şifre değiştirilmedi." });
    } catch (error) {
      results.push({ ok: false, key, fullName: group.fullName, phone: group.phone, email: group.email, studentNames, status: "error", message: error instanceof Error ? error.message : "Portal hesabı hazırlanamadı." });
    }
  }
  revalidatePath("/veliler");
  revalidatePath("/veliler/ogrenciden-olustur");
  return results;
}
