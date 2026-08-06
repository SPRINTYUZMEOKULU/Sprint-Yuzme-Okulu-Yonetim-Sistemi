import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile, type UserRole } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { Icons } from "@/app/components/dashboard-icons";
import "./dashboard.css";

export const dynamic = "force-dynamic";

type MenuItem = { label: string; href: string; roles: UserRole[]; icon: keyof typeof Icons; group: string };
const allRoles: UserRole[] = ["owner","admin","branch_manager","registration_staff","accounting","coach","guardian"];
const management: UserRole[] = ["owner","admin","branch_manager"];
const staff: UserRole[] = ["owner","admin","branch_manager","registration_staff","accounting","coach"];

const menu: MenuItem[] = [
  { label: "Dashboard", href: "/", roles: allRoles, icon: "dashboard", group: "GENEL" },
  { label: "Ön Kayıtlar", href: "/on-kayitlar", roles: ["owner","admin","branch_manager","registration_staff"], icon: "note", group: "GENEL" },
  { label: "Öğrenciler", href: "/ogrenciler", roles: staff, icon: "child", group: "GENEL" },
  { label: "Veliler", href: "/veliler", roles: ["owner","admin","branch_manager","registration_staff"], icon: "users", group: "GENEL" },
  { label: "Şubeler", href: "/subeler", roles: management, icon: "branch", group: "EĞİTİM" },
  { label: "Gruplar", href: "/gruplar", roles: staff, icon: "branch", group: "EĞİTİM" },
  { label: "Ders Programı", href: "/ders-programi", roles: allRoles, icon: "calendar", group: "EĞİTİM" },
  { label: "Yoklama", href: "/yoklama", roles: ["owner","admin","branch_manager","coach"], icon: "check", group: "EĞİTİM" },
  { label: "Paketler", href: "/paketler", roles: ["owner","admin","branch_manager","registration_staff","accounting","guardian"], icon: "approval", group: "FİNANS" },
  { label: "Günlük Kasa", href: "/kasa", roles: ["owner","admin","branch_manager","accounting"], icon: "wallet", group: "FİNANS" },
  { label: "Ödemeler", href: "/odemeler", roles: ["owner","admin","branch_manager","accounting","guardian"], icon: "wallet", group: "FİNANS" },
  { label: "Hazır Mesajlar", href: "/hazir-mesajlar", roles: staff, icon: "message", group: "İLETİŞİM" },
  { label: "Uyarılar", href: "/uyarilar", roles: staff, icon: "bell", group: "YÖNETİM" },
  { label: "Onay Merkezi", href: "/onay-merkezi", roles: management, icon: "approval", group: "YÖNETİM" },
  { label: "Raporlar", href: "/raporlar", roles: management, icon: "chart", group: "YÖNETİM" },
  { label: "Ayarlar", href: "/ayarlar", roles: ["owner","admin"], icon: "settings", group: "YÖNETİM" }
];

const roleLabels: Record<UserRole, string> = {
  pending: "Onay Bekliyor", owner: "Kurucu Yönetici", admin: "Yönetici",
  branch_manager: "Şube Yöneticisi", registration_staff: "Kayıt Personeli",
  accounting: "Muhasebe", coach: "Eğitmen", guardian: "Veli"
};

async function safeCount(table: string, filters?: Array<[string,string]>) {
  try {
    const supabase = await createClient();
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    for (const [key, value] of filters || []) query = query.eq(key, value);
    const { count, error } = await query;
    return error ? 0 : (count || 0);
  } catch { return 0; }
}

export default async function HomePage() {
  const profile = await requireProfile();
  if (profile.role === "guardian") redirect("/veli-paneli");
  const visibleMenu = menu.filter((item) => item.roles.includes(profile.role));
  const isCoach = profile.role === "coach";
  const isGuardian = profile.role === "guardian";
  const isManager = management.includes(profile.role);

  const [activeStudents, preRegistrations, openAlerts, pendingApprovals, pendingCash] = await Promise.all([
    safeCount("students", [["status","active"]]),
    safeCount("students", [["status","pre_registration"]]),
    safeCount("alerts", [["status","open"]]),
    safeCount("approval_requests", [["status","pending"]]),
    safeCount("payments", [["cash_status","handoff_pending"]])
  ]);

  const today = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const firstName = (profile.full_name || "SprintOS Kullanıcısı").split(" ")[0];

  const managerStats = [
    { label: "Aktif Öğrenci", value: activeStudents, note: "Tüm şubeler", icon: "child" as const, tone: "blue" },
    { label: "Bekleyen Ön Kayıt", value: preRegistrations, note: "Geri dönüş bekliyor", icon: "note" as const, tone: "orange" },
    { label: "Açık Uyarı", value: openAlerts, note: "İşlem gerektiriyor", icon: "bell" as const, tone: "red" },
    { label: "Kasa Onayı", value: pendingCash, note: "Teslim onayı bekliyor", icon: "wallet" as const, tone: "purple" }
  ];
  const coachStats = [
    { label: "Bugünkü Dersim", value: 0, note: "Planlanan ders", icon: "calendar" as const, tone: "blue" },
    { label: "Bu Ay Girdiğim", value: 0, note: "Onaylı ders", icon: "check" as const, tone: "green" },
    { label: "Yoklama Bekleyen", value: 0, note: "Tamamlanacak", icon: "clock" as const, tone: "orange" },
    { label: "Açık Görev", value: openAlerts, note: "Size atanan", icon: "bell" as const, tone: "purple" }
  ];
  const guardianStats = [
    { label: "Kalan Ders", value: 0, note: "Aktif paket", icon: "calendar" as const, tone: "blue" },
    { label: "Sıradaki Ders", value: "—", note: "Program bilgisi", icon: "clock" as const, tone: "green" },
    { label: "Devam Oranı", value: "%0", note: "Katılım geçmişi", icon: "chart" as const, tone: "orange" },
    { label: "Ödeme Durumu", value: "—", note: "Aktif paket", icon: "wallet" as const, tone: "purple" }
  ];
  const stats = isCoach ? coachStats : isGuardian ? guardianStats : managerStats;

  const groups = [...new Set(visibleMenu.map((item) => item.group))];

  return (
    <main className="proShell">
      <aside className="proSidebar">
        <div className="proBrand">
          <div className="proLogo">S</div>
          <div><strong>SprintOS</strong><span>Yüzme Okulu Yönetimi</span></div>
        </div>

        <nav className="proNav">
          {groups.map((group) => (
            <div className="navGroup" key={group}>
              <p>{group}</p>
              {visibleMenu.filter((item) => item.group === group).map((item) => {
                const Icon = Icons[item.icon];
                return <Link key={item.href} href={item.href} className={item.href === "/" ? "proNavItem active" : "proNavItem"}><Icon/><span>{item.label}</span>{item.href === "/uyarilar" && openAlerts > 0 ? <b>{openAlerts}</b> : null}</Link>;
              })}
            </div>
          ))}
        </nav>

        <div className="proUser">
          <div className="avatar">{(profile.full_name || profile.email || "S").charAt(0).toUpperCase()}</div>
          <div><strong>{profile.full_name || profile.email || "Kullanıcı"}</strong><span>{roleLabels[profile.role]}</span></div>
          <Link href="/auth/signout" title="Çıkış Yap"><Icons.logout/></Link>
        </div>
      </aside>

      <section className="proMain">
        <header className="proTopbar">
          <div className="searchBox"><Icons.search/><span>Öğrenci, veli veya grup ara...</span><kbd>⌘ K</kbd></div>
          <div className="topActions"><button aria-label="Bildirimler"><Icons.bell/>{openAlerts > 0 ? <i/> : null}</button><span className="dateText">{today}</span></div>
        </header>

        <div className="dashboardContent">
          <section className="heroRow">
            <div><p className="heroEyebrow">SPRİNT YÜZME OKULU</p><h1>Hoş geldiniz, {firstName}</h1><p>{isCoach ? "Bugünkü derslerinizi ve yoklamalarınızı buradan yönetin." : isGuardian ? "Öğrencinizin ders, paket ve ödeme bilgilerini takip edin." : "Günlük operasyonunuzu tek ekrandan yönetin."}</p></div>
            <div className="heroActions">
              {isCoach ? <Link className="actionPrimary" href="/yoklama"><Icons.check/>Derse Geldim</Link> : isGuardian ? <Link className="actionPrimary" href="/ders-programi"><Icons.calendar/>Ders Programım</Link> : <><Link className="actionSecondary" href="/hazir-mesajlar"><Icons.message/>Hızlı Mesaj</Link><Link className="actionPrimary" href="/on-kayit"><span>+</span>Yeni Ön Kayıt</Link></>}
            </div>
          </section>

          <section className="proStats">
            {stats.map((stat) => { const Icon = Icons[stat.icon]; return <article className={`proStat ${stat.tone}`} key={stat.label}><div className="statIcon"><Icon/></div><div><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.note}</small></div></article>; })}
          </section>

          <section className="dashboardGrid">
            <article className="dashCard scheduleCard">
              <div className="dashCardHeader"><div><p>GÜNLÜK OPERASYON</p><h2>{isCoach ? "Bugünkü Programım" : isGuardian ? "Yaklaşan Dersler" : "Bugünkü Dersler"}</h2></div><Link href="/ders-programi">Takvimi Aç <Icons.arrow/></Link></div>
              <div className="emptyPro"><div className="emptyIcon"><Icons.calendar/></div><strong>Bugün için henüz ders kaydı bulunmuyor</strong><span>Ders programı modülünü kurduğumuzda yaklaşan dersler burada canlı görünecek.</span><Link href="/ders-programi">Ders programına git</Link></div>
            </article>

            <article className="dashCard alertCard">
              <div className="dashCardHeader"><div><p>ÖNCELİKLER</p><h2>Akıllı Uyarılar</h2></div><Link href="/uyarilar">Tümü <Icons.arrow/></Link></div>
              <div className="alertList">
                {openAlerts > 0 ? <div className="alertItem urgent"><span><Icons.bell/></span><div><strong>{openAlerts} açık uyarı bulunuyor</strong><small>Öncelikli işlemleri kontrol edin.</small></div><Link href="/uyarilar">İncele</Link></div> : <div className="alertItem success"><span><Icons.check/></span><div><strong>Her şey yolunda</strong><small>Şu anda açık uyarı bulunmuyor.</small></div></div>}
                {isManager && pendingApprovals > 0 ? <div className="alertItem warning"><span><Icons.approval/></span><div><strong>{pendingApprovals} işlem onay bekliyor</strong><small>Onay merkezinde kararınızı belirtin.</small></div><Link href="/onay-merkezi">Aç</Link></div> : null}
              </div>
            </article>

            <article className="dashCard quickCard">
              <div className="dashCardHeader"><div><p>HIZLI İŞLEMLER</p><h2>Tek Tıkla Başlat</h2></div></div>
              <div className="quickGrid">
                {(isCoach ? [["Derse Geldim","/yoklama","check"],["Yoklama Al","/yoklama","users"],["Programım","/ders-programi","calendar"],["Not Ekle","/notlar","note"]] : isGuardian ? [["Ders Programım","/ders-programi","calendar"],["Paketim","/paketler","approval"],["Ödemelerim","/odemeler","wallet"],["Duyurular","/uyarilar","bell"]] : [["Yeni Ön Kayıt","/on-kayit","note"],["Öğrenci Ekle","/ogrenciler","child"],["Ödeme Al","/odemeler","wallet"],["Mesaj Gönder","/hazir-mesajlar","message"]]).map(([label,href,icon]) => { const Icon = Icons[icon as keyof typeof Icons]; return <Link key={label} href={href}><span><Icon/></span><strong>{label}</strong><Icons.arrow/></Link>; })}
              </div>
            </article>

            <article className="dashCard branchCard">
              <div className="dashCardHeader"><div><p>ŞUBE DURUMU</p><h2>Aktif Lokasyonlar</h2></div><Link href="/ayarlar">Yönet <Icons.arrow/></Link></div>
              <div className="branchList">
                {["Lara Life City","Konyaaltı Öğretmenevi","Meltem Yüzme Havuzu","Süleyman Erol Olimpik"].map((name, index) => <div key={name}><span className={`branchDot b${index+1}`}/><strong>{name}</strong><small>Aktif</small></div>)}
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
