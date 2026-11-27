import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { addSecondaryGuardian } from "../../ogrenciden-olustur/bulk-account-actions";
import GuardianIcon from "../../guardian-icon";
import "../../guardian-management.css";

export default async function StudentGuardianCenter({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; manage?: string }>;
}) {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
  const { id } = await params;
  const { error, manage } = await searchParams;
  const organizationId = profile.organization_id;
  if (!organizationId) notFound();

  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase.from("students")
    .select("id,first_name,last_name,is_deleted")
    .eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (studentError) throw new Error("Öğrenci dosyası yüklenemedi.");
  if (!student) notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase bağlantısı yapılandırılmamış.");
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: links, error: linksError } = await admin.from("guardian_students")
    .select("guardian_id,relationship,is_primary")
    .eq("student_id", student.id)
    .order("is_primary", { ascending: false }).order("guardian_id");
  if (linksError) throw new Error("Bağlı veli hesapları yüklenemedi.");

  const { data: guardians, error: guardiansError } = links.length
    ? await admin.from("guardians").select("id,auth_user_id")
      .eq("organization_id", organizationId).in("id", links.map(link => link.guardian_id))
    : { data: [], error: null };
  if (guardiansError) throw new Error("Veli kayıtları yüklenemedi.");

  const accountByGuardian = new Map(guardians.map(guardian => [guardian.id, guardian.auth_user_id]));
  const accountIds = [...new Set(guardians.flatMap(guardian => guardian.auth_user_id ? [guardian.auth_user_id] : []))];
  const { data: accounts, error: accountsError } = accountIds.length
    ? await admin.from("profiles").select("id,full_name,phone")
      .eq("organization_id", organizationId).eq("role", "guardian").in("id", accountIds)
    : { data: [], error: null };
  if (accountsError) throw new Error("Veli profilleri yüklenemedi.");

  const accountsById = new Map(accounts.map(account => [account.id, account]));
  const choices = links.flatMap(link => {
    const account = accountsById.get(accountByGuardian.get(link.guardian_id));
    return account ? [{ account, link }] : [];
  });

  const studentPath = `/ogrenciler/${student.id}`;
  const filePath = (accountId: string) => `/veliler/${accountId}?student=${student.id}`;
  if (choices.length === 1 && manage !== "1" && !error) redirect(filePath(choices[0].account.id));
  if (choices.length === 0 && !student.is_deleted) {
    redirect(`/veliler/ogrenciden-olustur?student=${student.id}`);
  }

  return <>
    <UstGezinme />
    <main className="guardianAdminPage">
      <div className="guardianAdminWrap">
        <header className="guardianHero">
          <div>
            <h1>Veli Merkezi</h1>
            <p>{student.first_name} {student.last_name}</p>
          </div>
          <div className="guardianHeroActions">
            <Link href={studentPath}>Öğrenci Dosyasına Dön</Link>
          </div>
        </header>
        {choices.length ? <section className="guardianPanel">
          <h2>Yönetmek istediğiniz hesabı seçin</h2>
          <div className="guardianChildren">
            {choices.map(({ account, link }) => <div className="guardianChild" key={account.id}>
              <span>
                <b>{account.full_name || "Portal hesabı"}</b>
                <small>{link.relationship || "Veli"}{link.is_primary ? " · Birincil" : ""}</small>
                {account.phone && <small>{account.phone}</small>}
              </span>
              <Link className="guardianStudentFileButton" href={filePath(account.id)}>
                Veli Dosyasını Aç <GuardianIcon name="arrow" />
              </Link>
            </div>)}
          </div>
        </section> : <p className="guardianEmpty">Arşivdeki bu öğrenciye bağlı bir portal hesabı bulunamadı.</p>}
        {!student.is_deleted && choices.some(({ link }) => link.is_primary) && <section className="guardianPanel">
          <h2>İkinci veliye portal erişimi ver</h2>
          {error && <p className="guardianNotice error" role="alert">{error}</p>}
          <form action={addSecondaryGuardian} className="guardianForm">
            <input type="hidden" name="student_id" value={student.id} />
            <label>Veli adı soyadı <input name="full_name" required maxLength={120} /></label>
            <label>Cep telefonu <input name="phone" type="tel" required maxLength={30} /></label>
            <button className="guardianButton">İkinci veliyi bağla</button>
          </form>
        </section>}
      </div>
    </main>
  </>;
}
