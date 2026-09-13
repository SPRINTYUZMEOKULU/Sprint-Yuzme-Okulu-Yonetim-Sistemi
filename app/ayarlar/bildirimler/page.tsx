import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";
import NotificationSettingsClient from "./notification-settings-client";
import NotificationRoutingClient from "./notification-routing-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu ayarları eksik.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export default async function NotificationSettingsPage() {
  const current = await requireProfile(["owner", "admin"]);
  if (!current.organization_id) return null;

  const admin = getAdminClient();
  const [profilesResult, staffResult, preferencesResult, pushResult] = await Promise.all([
    admin.from("profiles").select("id,full_name,email,phone,role,is_active").eq("organization_id", current.organization_id).eq("is_active", true).in("role", ["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"]).order("full_name"),
    admin.from("staff").select("auth_user_id,title,staff_type,all_branches,is_active,login_enabled").eq("organization_id", current.organization_id).eq("is_active", true),
    admin.from("notification_user_preferences").select("profile_id,category,in_app_enabled,push_enabled,can_approve,scope").eq("organization_id", current.organization_id),
    admin.from("push_subscriptions").select("profile_id").eq("organization_id", current.organization_id).eq("is_active", true),
  ]);

  const staffMap = new Map((staffResult.data ?? []).map((row) => [String(row.auth_user_id), row]));
  const profiles = (profilesResult.data ?? []).map((profile) => {
    const staff = staffMap.get(String(profile.id));
    return {
      id: String(profile.id),
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: String(profile.role),
      title: staff?.title ?? null,
      staff_type: staff?.staff_type ?? null,
      all_branches: staff?.all_branches ?? null,
    };
  });
  const activePushProfileIds = Array.from(new Set((pushResult.data ?? []).map((row) => String(row.profile_id)).filter(Boolean)));

  return (
    <main className="notificationPage">
      <div className="notificationContainer">
        <header className="notificationHeader">
          <div className="notificationHeaderCopy">
            <div className="notificationEyebrow">SPRINTOS · İLETİŞİM & YETKİ YÖNETİMİ</div>
            <h1>Bildirim Dağıtım & Yetki Merkezi</h1>
            <p>Hangi bildirimin hangi kullanıcıya düşeceğini, telefon push gönderimini, işlem onay yetkisini ve bildirim kapsamını tek merkezden yönetin.</p>
          </div>
          <div className="notificationHeaderActions">
            <Link href="/bildirimler">Bildirim Merkezi</Link>
            <Link href="/kullanicilar-ve-yetkiler">Kullanıcı & Yetkiler</Link>
            <Link href="/ayarlar">Ayarlar</Link>
          </div>
        </header>

        {(profilesResult.error || staffResult.error || preferencesResult.error || pushResult.error) ? (
          <section className="loadWarning">
            <strong>Bazı bildirim verileri yüklenemedi.</strong>
            <span>{profilesResult.error?.message || staffResult.error?.message || preferencesResult.error?.message || pushResult.error?.message}</span>
          </section>
        ) : null}

        <NotificationRoutingClient profiles={profiles} preferences={(preferencesResult.data ?? []) as never[]} activePushProfileIds={activePushProfileIds} />

        <section className="deviceSection">
          <div className="deviceSectionHead">
            <div className="deviceGlyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/><path d="M18.5 7.5a3 3 0 0 1 0 5"/></svg></div>
            <div><span>BU CİHAZ</span><h2>Telefon Push Bildirimleri</h2><p>Bu bölümden yalnızca kullandığınız telefon veya tarayıcının push aboneliğini açıp kapatabilirsiniz.</p></div>
          </div>
          <NotificationSettingsClient />
        </section>

        <section className="notificationInfoGrid">
          <article><div className="miniIcon blue">1</div><div><b>Kişiye özel dağıtım</b><p>Her kullanıcı yalnızca yetkili olduğu bildirim kategorilerini görür.</p></div></article>
          <article><div className="miniIcon violet">2</div><div><b>Push ayrı yönetilir</b><p>Uygulama içi bildirim açık kalırken telefon push bildirimi ayrı kapatılabilir.</p></div></article>
          <article><div className="miniIcon amber">3</div><div><b>Onay ayrı yetkidir</b><p>Bildirimi görmek, işlemi onaylayabilmek anlamına gelmez. Onay yetkisi ayrıca verilir.</p></div></article>
          <article><div className="miniIcon green">4</div><div><b>Kapsam kontrolü</b><p>Tüm şubeler, yetkili şubeler veya yalnız kendi grup/seansları seçilebilir.</p></div></article>
        </section>
      </div>

      <style>{`
        *{box-sizing:border-box}.notificationPage{min-height:100vh;padding:30px;background:linear-gradient(180deg,#f4f8fd 0,#f7f9fc 38%,#f4f7fb 100%);color:#14213d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.notificationContainer{max-width:1500px;margin:0 auto}.notificationHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:18px;padding:4px 2px}.notificationEyebrow{color:#176de9;font-size:10px;font-weight:950;letter-spacing:1.5px}.notificationHeader h1{margin:6px 0 0;font-size:34px;line-height:1.06;letter-spacing:-1.2px;color:#10213e}.notificationHeader p{max-width:850px;margin:9px 0 0;color:#708096;font-size:13px;line-height:1.6}.notificationHeaderActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.notificationHeaderActions a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 13px;border:1px solid #d6e0ec;border-radius:11px;background:#fff;color:#3f526d;text-decoration:none;font-size:10px;font-weight:900;box-shadow:0 4px 14px rgba(15,23,42,.025)}.notificationHeaderActions a:hover{border-color:#a9c9f8;background:#f8fbff;color:#176de9}.loadWarning{display:grid;gap:4px;margin-bottom:14px;padding:12px 14px;border:1px solid #fed7aa;border-radius:13px;background:#fff7ed;color:#9a3412;font-size:11px}.deviceSection{margin-top:18px;padding:17px;border:1px solid #dce5f0;border-radius:21px;background:#f9fbfe}.deviceSectionHead{display:flex;align-items:center;gap:12px;margin-bottom:12px}.deviceGlyph{width:45px;height:45px;display:grid;place-items:center;flex:0 0 auto;border-radius:13px;background:#edf5ff;color:#176de9}.deviceGlyph svg{width:22px;height:22px}.deviceSectionHead span{display:block;color:#176de9;font-size:9px;font-weight:950;letter-spacing:1.2px}.deviceSectionHead h2{margin:3px 0 0;color:#162b49;font-size:18px}.deviceSectionHead p{margin:4px 0 0;color:#7d8ca1;font-size:10px;line-height:1.5}.notificationInfoGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.notificationInfoGrid article{display:flex;align-items:flex-start;gap:10px;padding:13px;border:1px solid #e0e7f0;border-radius:15px;background:#fff}.notificationInfoGrid b{display:block;color:#213653;font-size:11px}.notificationInfoGrid p{margin:5px 0 0;color:#7d8ca0;font-size:9px;line-height:1.5}.miniIcon{width:27px;height:27px;display:grid;place-items:center;flex:0 0 auto;border-radius:9px;font-size:10px;font-weight:950}.miniIcon.blue{background:#edf5ff;color:#176de9}.miniIcon.violet{background:#f2efff;color:#7156d8}.miniIcon.amber{background:#fff6e5;color:#b97500}.miniIcon.green{background:#eafaf2;color:#178458}@media(max-width:900px){.notificationHeader{display:grid}.notificationHeaderActions{justify-content:flex-start}.notificationInfoGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.notificationPage{padding:18px 12px 28px}.notificationHeader h1{font-size:27px}.notificationHeader p{font-size:11px}.notificationHeaderActions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.notificationHeaderActions a{padding:0 8px;font-size:9px}.deviceSection{padding:12px;border-radius:17px}.notificationInfoGrid{grid-template-columns:1fr}.deviceSectionHead{align-items:flex-start}}
      `}</style>
    </main>
  );
}
