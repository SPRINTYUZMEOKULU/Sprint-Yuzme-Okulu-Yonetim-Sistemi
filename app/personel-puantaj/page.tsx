import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import { isLessonDate } from "@/lib/personnel/sessions";
import CoachHome from "./coach-home";
import PersonelPuantajClient from "./personel-puantaj-client";
import PersonelOdemeleri from "./personel-odemeleri";
import "./personel-puantaj.css";

export const dynamic = "force-dynamic";

export default async function PersonelPuantajPage({ searchParams }: { searchParams: Promise<{ personel?: string; date?: string }> }) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const { personel, date } = await searchParams;
  const initialDate = date && isLessonDate(date) ? date : undefined;
  if (profile.base_role === "coach") return <CoachHome key={initialDate} profile={profile} initialDate={initialDate} />;
  let directory: Array<{ id: string; auth_user_id: string | null; first_name: string; last_name: string; title: string | null }> = [];
  let directoryError = false;
  if (profile.is_active && profile.organization_id && ["owner", "admin"].includes(profile.base_role)) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await db.from("staff").select("id,auth_user_id,first_name,last_name,title")
      .eq("organization_id", profile.organization_id).eq("is_active", true).order("first_name").order("last_name");
    directory = result.data || [];
    directoryError = Boolean(result.error);
    const selected = directory.find((person) => person.id === personel);
    if (selected) return <CoachHome key={`${selected.id}:${initialDate || ""}`} profile={profile} initialDate={initialDate} preview={{
      id: selected.id, name: `${selected.first_name} ${selected.last_name}`.trim(), profileId: selected.auth_user_id,
    }} />;
  }

  const canManagePay = ["owner", "admin", "branch_manager", "accounting"].includes(profile.role);

  return (
    <>
      <UstGezinme />
      <main className="ppPage">
        <section className="ppShell">
          <header className="ppHeader">
            <div>
              <h1>Personel ve Puantaj</h1>
            </div>
            <nav className="ppHeaderActions" aria-label="Personel işlemleri">
              {["owner", "admin", "branch_manager"].includes(profile.role) ? <Link href="/operasyon-plani" className="ppBack">Antrenör / Seans Düzenle</Link> : null}
              {canManagePay ? <Link href="/personel-puantaj/ucret-ayarlari" className="ppBack">Ücret Ayarları</Link> : null}
              <Link href="/" className="ppBack">Ana Sayfa</Link>
            </nav>
          </header>

          {directoryError ? <p role="alert">Personel listesi yüklenemedi.</p> : null}
          {directory.length ? (
            <form className="ppPersonPicker" action="/personel-puantaj">
              <label htmlFor="pp-person">Personel ekranı</label>
              <div className="ppPersonPickerControls">
                <select id="pp-person" name="personel" required defaultValue="">
                  <option value="" disabled>Personel seçin</option>
                  {directory.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}{person.title ? ` · ${person.title}` : ""}</option>)}
                </select>
                <button type="submit" className="ppPrimary">Paneli aç</button>
              </div>
            </form>
          ) : null}
          <PersonelPuantajClient currentRole={profile.role} />
          {canManagePay ? <div style={{ marginTop: 16 }}><PersonelOdemeleri /></div> : null}
        </section>
      </main>
    </>
  );
}
