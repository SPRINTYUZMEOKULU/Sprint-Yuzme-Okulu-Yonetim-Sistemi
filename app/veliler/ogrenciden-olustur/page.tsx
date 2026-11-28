import { activePortalStudentIds } from "@/lib/guardian/portal-student-eligibility";
import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import UstGezinme from "@/app/components/UstGezinme";
import { normalizePortalPhone as normalizePhone, resolvePortalRecipient } from "@/lib/guardian/portal-recipient";
import { requireProfile } from "@/lib/auth/profile";
import { createOrLinkGuardianFromStudent } from "./actions";
import BulkAccountManager, { type GuardianBulkCandidate } from "./bulk-account-manager";
import "./wizard.css";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function norm(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

export default async function GuardianFromStudentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
  const query = await searchParams;
  const organizationId = profile.organization_id!;
  const admin = adminClient();

  const studentId = typeof query.student === "string" ? query.student : "";
  const studentsQuery = admin.from("students")
    .select("id,student_number,first_name,last_name,status,phone,guardian_name,guardian_phone,guardian_email,branch_id,preferred_group_id")
    .eq("organization_id", organizationId).eq("is_deleted", false).eq("status", "active");
  const linksQuery = admin.from("guardian_students").select("guardian_id,student_id,relationship,is_primary");

  const [studentsRes, linksRes, guardiansRes, guardianRecordsRes, branchesRes, groupsRes] = await Promise.all([
    studentId ? studentsQuery.eq("id", studentId) : studentsQuery.order("first_name").limit(5000),
    studentId ? linksQuery.eq("student_id", studentId) : linksQuery.limit(5000),
    admin.from("profiles").select("id,full_name,phone,email,is_active,last_sign_in_at").eq("organization_id", organizationId).eq("role", "guardian").limit(5000),
    admin.from("guardians").select("id,auth_user_id,full_name,phone,email,is_active,login_enabled").eq("organization_id", organizationId).limit(5000),
    admin.from("branches").select("id,name").eq("organization_id", organizationId),
    admin.from("training_groups").select("id,name,course_type").eq("organization_id", organizationId).limit(5000),
  ]);

  if (studentsRes.error) throw new Error("Kursiyer listesi okunamadı.");
  const activeIds = await activePortalStudentIds(admin, organizationId, (studentsRes.data || []).map((student) => student.id));
  const students = (studentsRes.data || []).filter((student) => activeIds.has(student.id));
  const guardians = guardiansRes.data || [];
  const guardianRecords = guardianRecordsRes.data || [];
  const guardianRecordById = new Map(guardianRecords.map((g: any) => [g.id, g]));
  const guardianRecordIds = new Set(guardianRecords.map((g: any) => g.id));
  const links = (linksRes.data || []).filter((l: any) => guardianRecordIds.has(l.guardian_id));
  const linkByStudent = new Map<string, (typeof links)[number]>();
  for (const link of links) {
    if (link.is_primary || !linkByStudent.has(link.student_id)) linkByStudent.set(link.student_id, link);
  }
  const guardianById = new Map(guardians.map((g: any) => [g.id, g]));
  const branchMap = new Map((branchesRes.data || []).map((b: any) => [b.id, b.name]));
  const groupMap = new Map((groupsRes.data || []).map((g: any) => [g.id, g]));

  const guardianByPhone = new Map<string, any>();
  for (const guardian of guardians as any[]) {
    const normalized = normalizePhone(guardian.phone);
    if (normalized) guardianByPhone.set(normalized, guardian);
  }

  const search = norm(query.q);
  const filter = studentId ? "all" : query.filter || "unlinked";
  const rows = students.map((student: any) => {
    const link: any = linkByStudent.get(student.id);
    const guardianRecord: any = link ? guardianRecordById.get(link.guardian_id) : null;
    const linkedGuardian: any = guardianRecord?.auth_user_id ? guardianById.get(guardianRecord.auth_user_id) : null;
    const group = groupMap.get(student.preferred_group_id);
    const { phone: accountPhone, fullName: accountName, relationship } = resolvePortalRecipient(student, group);
    const usesSelf = relationship === "Kendisi";
    const existingGuardian = !linkedGuardian && accountPhone ? guardianByPhone.get(accountPhone) : null;
    const ready = Boolean(accountName && accountPhone);
    return { student, link, linkedGuardian, existingGuardian, ready, accountPhone, accountName, usesSelf, group };
  }).filter((row: any) => {
    if (filter === "unlinked" && row.linkedGuardian) return false;
    if (filter === "ready" && (row.linkedGuardian || !row.ready)) return false;
    if (filter === "missing" && (row.linkedGuardian || row.ready)) return false;
    if (filter === "linked" && !row.linkedGuardian) return false;
    if (!search) return true;
    return norm(`${row.student.first_name} ${row.student.last_name} ${row.student.student_number} ${row.student.phone} ${row.student.guardian_name} ${row.student.guardian_phone} ${row.student.guardian_email} ${row.group?.name || ""} ${row.group?.course_type || ""}`).includes(search);
  });

  const derived = students.map(s => ({
    id: s.id,
    ready: !resolvePortalRecipient(s, groupMap.get(s.preferred_group_id)).error,
  }));
  const hasPortalAccount=(studentId:string)=>links.some((link:any)=>{
    if(link.student_id!==studentId)return false;
    const record:any=guardianRecordById.get(link.guardian_id);
    return Boolean(record?.auth_user_id&&guardianById.has(record.auth_user_id));
  });
  const unlinkedCount = students.filter((s: any) => !hasPortalAccount(s.id)).length;
  const readyCount = derived.filter((s: any) => !hasPortalAccount(s.id) && s.ready).length;
  const missingCount = derived.filter((s: any) => !hasPortalAccount(s.id) && !s.ready).length;

  const deliveries = new Map<string, NonNullable<GuardianBulkCandidate["delivery"]>>();
  if (!studentId) {
    const { data: logs, error } = await admin.from("message_logs")
      .select("guardian_id,status,metadata,prepared_by")
      .eq("organization_id", organizationId).eq("template_key", "guardian_portal_setup")
      .eq("channel", "whatsapp").in("status", ["sent", "prepared"])
      .order("prepared_at", { ascending: false });
    if (error) throw new Error("Portal gönderim geçmişi okunamadı.");
    for (const log of logs || []) {
      if (!log.guardian_id || deliveries.get(log.guardian_id)?.status === "sent") continue;
      if (log.status === "sent") {
        deliveries.set(log.guardian_id, { status: "sent" });
      } else if (!deliveries.has(log.guardian_id)) {
        deliveries.set(log.guardian_id, {
          status: "prepared",
          dispatchId: log.prepared_by === profile.id && typeof log.metadata?.dispatch_id === "string"
            ? log.metadata.dispatch_id : undefined,
        });
      }
    }
  }

  const candidateMap = new Map<string, GuardianBulkCandidate>();
  for (const student of students as any[]) {
    const link: any = linkByStudent.get(student.id);
    const guardianRecord: any = link ? guardianRecordById.get(link.guardian_id) : null;
    const linkedProfile: any = guardianRecord?.auth_user_id ? guardianById.get(guardianRecord.auth_user_id) : null;
    const group: any = groupMap.get(student.preferred_group_id);
    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const recipient = resolvePortalRecipient(student, group);
    const phone = normalizePhone(linkedProfile?.phone || guardianRecord?.phone) || recipient.phone;
    const fullName = String(linkedProfile?.full_name || guardianRecord?.full_name || recipient.fullName).trim();
    if (!phone || !fullName) continue;
    const state: GuardianBulkCandidate["state"] = linkedProfile ? (linkedProfile.last_sign_in_at ? "active" : "pending") : "new";
    const accountId = linkedProfile?.id || guardianByPhone.get(phone)?.id;
    const delivery = accountId ? deliveries.get(accountId) : undefined;
    const existing = candidateMap.get(phone);
    if (existing) {
      existing.studentIds.push(student.id);
      existing.studentNames.push(studentName);
      if (state === "active") existing.state = "active";
      if (delivery?.status === "sent" || !existing.delivery) existing.delivery = delivery;
    } else {
      candidateMap.set(phone, { key: phone, fullName, phone, studentIds: [student.id], studentNames: [studentName], state, delivery });
    }
  }
  const bulkCandidates = [...candidateMap.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));

  return <><UstGezinme/><main className="guardianWizardPage"><div className="guardianWizardWrap">
    <header className="wizardHero"><div><small>SPRİNTOS · PORTAL HESABI OLUŞTURMA</small><h1>Kursiyer / Veli Portal Hesabı Oluştur</h1><p>Kayıtlı veli adı ve cep telefonu önceliklidir. Yetişkin kursiyerlerde veli bilgileri eksikse kursiyerin kendi bilgileri kullanılır.</p></div>{studentId ? <Link href={`/ogrenciler/${encodeURIComponent(studentId)}`}>Öğrenci Dosyasına Dön</Link> : <Link href="/veliler">Portal Merkezine Dön</Link>}</header>

    {query.saved ? <div className="wizardNotice success"><strong>✓ İşlem tamamlandı</strong><span>{query.saved}</span>{query.guardian ? <div><Link href={`/veliler/${query.guardian}?student=${encodeURIComponent(studentId)}`}>Portal Dosyasını Aç</Link>{query.student ? <Link href={`/ogrenciler/${query.student}`}>Öğrenci Dosyasını Aç</Link> : null}</div> : null}</div> : null}
    {query.error ? <div className="wizardNotice error"><strong>İşlem tamamlanamadı</strong><span>{query.error}</span>{query.student ? <Link href={`/ogrenciler/${query.student}`}>Öğrenci bilgilerini düzenle</Link> : null}</div> : null}

    {!studentId && <>
    <section className="wizardStats"><Link href="?filter=unlinked"><span>Bağlantı Bekleyen</span><strong>{unlinkedCount}</strong></Link><Link href="?filter=ready"><span>Oluşturmaya Hazır</span><strong>{readyCount}</strong></Link><Link href="?filter=missing"><span>Bilgisi Eksik</span><strong>{missingCount}</strong></Link><Link href="?filter=linked"><span>Bağlı Kursiyer</span><strong>{links.length}</strong></Link></section>

    <BulkAccountManager candidates={bulkCandidates}/>

    <form className="wizardSearch"><input name="q" defaultValue={query.q || ""} placeholder="Kursiyer, veli veya telefon ara"/><select name="filter" defaultValue={filter}><option value="unlinked">Bağlantı bekleyenler</option><option value="ready">Oluşturmaya hazır</option><option value="missing">Bilgisi eksik</option><option value="linked">Zaten bağlı</option><option value="all">Tüm aktif kursiyerler</option></select><button>Filtrele</button></form>

    </>}

    <section className="wizardGrid">{rows.map(({ student, linkedGuardian, existingGuardian, ready, accountPhone, accountName, usesSelf, group }: any) => {
      const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
      const branchName = branchMap.get(student.branch_id) || "Şube yok";
      const statusClass = linkedGuardian ? "linked" : !ready ? "missing" : existingGuardian ? "existing" : "new";
      const statusText = linkedGuardian ? (usesSelf ? "Kursiyer portalı bağlı" : "Veli portalı bağlı") : !ready ? (usesSelf ? "Kursiyer telefonu eksik" : "Veli bilgisi eksik") : existingGuardian ? (usesSelf ? "Mevcut kursiyer portal hesabı bulundu" : "Mevcut veli portal hesabı bulundu") : usesSelf ? "Yeni kursiyer portal hesabı oluşturulacak" : "Yeni veli hesabı oluşturulacak";
      return <article className="wizardStudentCard" key={student.id}>
        <div className="wizardStudentHead"><div><small>{student.student_number || "Kursiyer"} · {branchName}{group?.course_type ? ` · ${group.course_type}` : ""}</small><h2>{studentName}</h2></div><span className={`wizardStatus ${statusClass}`}>{statusText}</span></div>
        <div className="wizardGuardianInfo"><div><span>{usesSelf ? "Hesap Sahibi / Kursiyer" : "Veli"}</span><strong>{accountName || "Ad bilgisi yok"}</strong></div><div><span>{usesSelf ? "Kursiyer Telefonu" : "Veli Telefonu"}</span><strong>{accountPhone || (usesSelf ? student.phone : student.guardian_phone) || "Telefon yok"}</strong></div>{student.guardian_email && !usesSelf ? <div><span>E-posta</span><strong>{student.guardian_email}</strong></div> : null}</div>
        {usesSelf ? <div className="wizardExisting"><span>{"Yetişkin kursiyer · kendi hesabı"}</span><strong>{studentName}</strong><small>Bu kayıt için veli hesabı açılmaz. Portal girişi kursiyerin kendi telefonu ve kendi hesabı üzerinden yapılır.</small></div> : null}
        {linkedGuardian ? <div className="wizardExisting"><span>{usesSelf ? "Bağlı kursiyer hesabı" : "Bağlı veli hesabı"}</span><strong>{linkedGuardian.full_name || "Portal kullanıcısı"}</strong><small>{linkedGuardian.phone || "Telefon yok"}</small></div> : existingGuardian ? <div className="wizardExisting"><span>{usesSelf ? "Aynı telefonla mevcut kursiyer hesabı" : "Aynı telefonla mevcut veli hesabı"}</span><strong>{existingGuardian.full_name || "Portal kullanıcısı"}</strong><small>Yeni hesap açılmayacak; bu kursiyer mevcut hesaba bağlanacak.</small></div> : null}
        <div className="wizardActions">{linkedGuardian ? <><Link href={`/veliler/${linkedGuardian.id}?student=${student.id}`}>Portal Dosyasını Aç</Link><Link href={`/ogrenciler/${student.id}`}>Kursiyer Dosyası</Link></> : ready ? <form action={createOrLinkGuardianFromStudent}><input type="hidden" name="student_id" value={student.id}/><input type="hidden" name="account_mode" value={usesSelf ? "self" : "guardian"}/><button className="primary">{existingGuardian ? (usesSelf ? "Mevcut Kursiyer Hesabını Bağla" : "Mevcut Veli Hesabını Bağla") : usesSelf ? "Kursiyer Portal Hesabı Oluştur" : "Veli Hesabı Oluştur ve Bağla"}</button></form> : <Link className="warning" href={`/ogrenciler/${student.id}`}>{usesSelf ? "Kursiyer Telefonunu Tamamla" : "Veli Bilgilerini Tamamla"}</Link>}</div>
      </article>;
    })}{!rows.length ? <div className="wizardEmpty">Bu filtreye uygun kursiyer bulunamadı.</div> : null}</section>
  </div></main></>;
}
