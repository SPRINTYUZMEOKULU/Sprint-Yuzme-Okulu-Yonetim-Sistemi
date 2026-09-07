import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import { createOrLinkGuardianFromStudent } from "./actions";
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

function normalizePhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.length === 10 && digits.startsWith("5") ? `+90${digits}` : "";
}

function phoneCandidates(phone: string) {
  if (!phone) return [];
  const local = phone.replace(/^\+90/, "");
  return [phone, `90${local}`, `0${local}`, local];
}

export default async function GuardianFromStudentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
  const query = await searchParams;
  const organizationId = profile.organization_id!;
  const admin = adminClient();

  const [studentsRes, linksRes, guardiansRes, branchesRes] = await Promise.all([
    admin.from("students").select("id,student_number,first_name,last_name,status,phone,guardian_name,guardian_phone,guardian_email,branch_id").eq("organization_id", organizationId).eq("is_deleted", false).order("first_name").limit(5000),
    admin.from("guardian_students").select("guardian_id,student_id,relationship,is_primary").limit(5000),
    admin.from("profiles").select("id,full_name,phone,email,is_active,last_sign_in_at").eq("organization_id", organizationId).eq("role", "guardian").limit(5000),
    admin.from("branches").select("id,name").eq("organization_id", organizationId),
  ]);

  const students = studentsRes.data || [];
  const guardians = guardiansRes.data || [];
  const guardianIds = new Set(guardians.map((g: any) => g.id));
  const links = (linksRes.data || []).filter((l: any) => guardianIds.has(l.guardian_id));
  const linkByStudent = new Map(links.map((l: any) => [l.student_id, l]));
  const guardianById = new Map(guardians.map((g: any) => [g.id, g]));
  const branchMap = new Map((branchesRes.data || []).map((b: any) => [b.id, b.name]));

  const guardianByPhone = new Map<string, any>();
  for (const guardian of guardians as any[]) {
    const normalized = normalizePhone(guardian.phone);
    for (const candidate of phoneCandidates(normalized)) guardianByPhone.set(candidate, guardian);
  }

  const search = norm(query.q);
  const filter = query.filter || "unlinked";
  const rows = students.map((student: any) => {
    const link: any = linkByStudent.get(student.id);
    const linkedGuardian: any = link ? guardianById.get(link.guardian_id) : null;
    const guardianPhone = normalizePhone(student.guardian_phone);
    const studentPhone = normalizePhone(student.phone);
    const guardianName = String(student.guardian_name || "").trim();
    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const usesSelf = !guardianName && !guardianPhone && Boolean(studentPhone);
    const accountPhone = guardianPhone || studentPhone;
    const accountName = guardianName || studentName;
    const existingGuardian = !linkedGuardian && accountPhone ? guardianByPhone.get(accountPhone) : null;
    const ready = Boolean(accountName && accountPhone);
    return { student, link, linkedGuardian, existingGuardian, ready, accountPhone, accountName, usesSelf };
  }).filter((row: any) => {
    if (filter === "unlinked" && row.linkedGuardian) return false;
    if (filter === "ready" && (row.linkedGuardian || !row.ready)) return false;
    if (filter === "missing" && (row.linkedGuardian || row.ready)) return false;
    if (filter === "linked" && !row.linkedGuardian) return false;
    if (!search) return true;
    return norm(`${row.student.first_name} ${row.student.last_name} ${row.student.student_number} ${row.student.phone} ${row.student.guardian_name} ${row.student.guardian_phone} ${row.student.guardian_email}`).includes(search);
  });

  const derived = students.map((s: any) => {
    const guardianPhone = normalizePhone(s.guardian_phone);
    const studentPhone = normalizePhone(s.phone);
    const guardianName = String(s.guardian_name || "").trim();
    const studentName = `${s.first_name || ""} ${s.last_name || ""}`.trim();
    const accountPhone = guardianPhone || studentPhone;
    const accountName = guardianName || studentName;
    return { id: s.id, ready: Boolean(accountName && accountPhone) };
  });
  const unlinkedCount = students.filter((s: any) => !linkByStudent.has(s.id)).length;
  const readyCount = derived.filter((s: any) => !linkByStudent.has(s.id) && s.ready).length;
  const missingCount = derived.filter((s: any) => !linkByStudent.has(s.id) && !s.ready).length;

  return <><UstGezinme/><main className="guardianWizardPage"><div className="guardianWizardWrap">
    <header className="wizardHero"><div><small>SPRİNTOS · PORTAL HESABI OLUŞTURMA</small><h1>Öğrenciden Portal Hesabı Oluştur</h1><p>Çocuk kursiyerlerde veli bilgisi kullanılır. Yetişkin kursiyerlerde veli zorunlu değildir; kursiyerin kendi telefon numarasıyla kendi portal hesabı oluşturulabilir.</p></div><Link href="/veliler">Veli Merkezine Dön</Link></header>

    {query.saved ? <div className="wizardNotice success"><strong>✓ İşlem tamamlandı</strong><span>{query.saved}</span>{query.guardian ? <div><Link href={`/veliler/${query.guardian}`}>Portal Dosyasını Aç</Link>{query.student ? <Link href={`/ogrenciler/${query.student}`}>Öğrenci Dosyasını Aç</Link> : null}</div> : null}</div> : null}
    {query.error ? <div className="wizardNotice error"><strong>İşlem tamamlanamadı</strong><span>{query.error}</span>{query.student ? <Link href={`/ogrenciler/${query.student}`}>Öğrenci bilgilerini düzenle</Link> : null}</div> : null}

    <section className="wizardStats"><Link href="?filter=unlinked"><span>Bağlantı Bekleyen</span><strong>{unlinkedCount}</strong></Link><Link href="?filter=ready"><span>Oluşturmaya Hazır</span><strong>{readyCount}</strong></Link><Link href="?filter=missing"><span>Bilgisi Eksik</span><strong>{missingCount}</strong></Link><Link href="?filter=linked"><span>Bağlı Öğrenci</span><strong>{links.length}</strong></Link></section>

    <form className="wizardSearch"><input name="q" defaultValue={query.q || ""} placeholder="Öğrenci, veli veya telefon ara"/><select name="filter" defaultValue={filter}><option value="unlinked">Bağlantı bekleyenler</option><option value="ready">Oluşturmaya hazır</option><option value="missing">Bilgisi eksik</option><option value="linked">Zaten bağlı</option><option value="all">Tüm öğrenciler</option></select><button>Filtrele</button></form>

    <section className="wizardGrid">{rows.map(({ student, linkedGuardian, existingGuardian, ready, accountPhone, accountName, usesSelf }: any) => {
      const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
      const branchName = branchMap.get(student.branch_id) || "Şube yok";
      const statusClass = linkedGuardian ? "linked" : !ready ? "missing" : existingGuardian ? "existing" : "new";
      const statusText = linkedGuardian ? "Portal bağlı" : !ready ? "İletişim bilgisi eksik" : existingGuardian ? "Mevcut portal hesabı bulundu" : usesSelf ? "Kursiyer kendi hesabını kullanacak" : "Yeni veli hesabı oluşturulacak";
      return <article className="wizardStudentCard" key={student.id}>
        <div className="wizardStudentHead"><div><small>{student.student_number || "Öğrenci"} · {branchName}</small><h2>{studentName}</h2></div><span className={`wizardStatus ${statusClass}`}>{statusText}</span></div>
        <div className="wizardGuardianInfo"><div><span>{usesSelf ? "Hesap Sahibi" : "Veli"}</span><strong>{accountName || "Ad bilgisi yok"}</strong></div><div><span>Telefon</span><strong>{accountPhone || student.guardian_phone || student.phone || "Telefon yok"}</strong></div>{student.guardian_email && !usesSelf ? <div><span>E-posta</span><strong>{student.guardian_email}</strong></div> : null}</div>
        {usesSelf ? <div className="wizardExisting"><span>Yetişkin / kendi hesabı</span><strong>{studentName}</strong><small>Veli bilgisi aranmayacak; kursiyerin kendi telefonu portal girişi için kullanılacak.</small></div> : null}
        {linkedGuardian ? <div className="wizardExisting"><span>Bağlı hesap</span><strong>{linkedGuardian.full_name || "Portal kullanıcısı"}</strong><small>{linkedGuardian.phone || "Telefon yok"}</small></div> : existingGuardian ? <div className="wizardExisting"><span>Aynı telefonla mevcut hesap</span><strong>{existingGuardian.full_name || "Portal kullanıcısı"}</strong><small>Yeni hesap açılmayacak; bu öğrenci mevcut hesaba bağlanacak.</small></div> : null}
        <div className="wizardActions">{linkedGuardian ? <><Link href={`/veliler/${linkedGuardian.id}`}>Portal Dosyasını Aç</Link><Link href={`/ogrenciler/${student.id}`}>Öğrenci Dosyası</Link></> : ready ? <form action={createOrLinkGuardianFromStudent}><input type="hidden" name="student_id" value={student.id}/><input type="hidden" name="account_mode" value={usesSelf ? "self" : "guardian"}/><button className="primary">{existingGuardian ? "Mevcut Hesaba Bağla" : usesSelf ? "Kursiyer Hesabı Oluştur ve Bağla" : "Veli Hesabı Oluştur ve Bağla"}</button></form> : <Link className="warning" href={`/ogrenciler/${student.id}`}>Eksik İletişim Bilgisini Tamamla</Link>}</div>
      </article>;
    })}{!rows.length ? <div className="wizardEmpty">Bu filtreye uygun öğrenci bulunamadı.</div> : null}</section>
  </div></main></>;
}
