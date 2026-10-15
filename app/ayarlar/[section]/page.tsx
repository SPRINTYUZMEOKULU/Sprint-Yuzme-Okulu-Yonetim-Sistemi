import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

type Destination = { title: string; description: string; href: string };
const sections: Record<string, { title: string; description: string; links: Destination[] }> = {
  kurum: {
    title: "Kurum Bilgileri",
    description: "Kurumun mevcut şube ve tesis kayıtlarını ilgili yönetim ekranlarından düzenleyin. Genel logo ve kurum profili düzenleyicisi henüz bulunmuyor.",
    links: [
      { title: "Şube Yönetimi", description: "Şube kayıtları ve iletişim bilgileri.", href: "/subeler" },
      { title: "Tesis ve Sezon Yönetimi", description: "Tesisler ve sezon planlaması.", href: "/tesis-sezon-yonetimi" },
    ],
  },
  belgeler: {
    title: "Belge ve PDF",
    description: "Belgeler ve çıktılar mevcut kayıtlarla bağlantılı yönetilir.",
    links: [
      { title: "Belge Yönetimi", description: "Veli portalına sunulan belgeler, sürümler ve onay gereksinimleri.", href: "/veliler/icerik" },
      { title: "Rapor ve Çıktılar", description: "A4, PDF ve Excel raporları.", href: "/raporlar" },
      { title: "Öğrenci Dosyaları", description: "Öğrenciye ait kayıt ve belge işlemleri.", href: "/ogrenciler" },
    ],
  },
  sistem: {
    title: "Sistem Ayarları",
    description: "İşlemler aynı sistemdeki mevcut ayar ve kontrol ekranlarına bağlıdır.",
    links: [
      { title: "Kayıt Formu", description: "Görünür ve zorunlu kayıt alanları.", href: "/ayarlar/on-kayit-formu" },
      { title: "Onay Kuralları", description: "Kritik işlemler için yönetici onayları.", href: "/ayarlar/onay-merkezi" },
      { title: "Bildirim Ayarları", description: "Bildirim tercihleri, sesler ve yönlendirmeler.", href: "/ayarlar/bildirimler" },
      { title: "Denetim Merkezi", description: "Sistemdeki eksikleri ve kontrolleri inceleyin.", href: "/denetim-merkezi" },
    ],
  },
};

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireProfile(["owner", "admin"]);
  const { section } = await params;
  // Preserve previously shared settings URLs while using the existing source of truth.
  if (section === "yetkiler") redirect("/kullanicilar-ve-yetkiler");
  if (section === "kurallar") redirect("/veliler/icerik");
  const current = sections[section];
  if (!current || !Object.hasOwn(sections, section)) notFound();
  return <main className="settingsSection">
    <div className="settingsSectionWrap">
      <Link href="/ayarlar">← Ayarlar Merkezi</Link>
      <header><p>SPRINTOS · YÖNETİM</p><h1>{current.title}</h1><p>{current.description}</p></header>
      <nav aria-label={current.title}>{current.links.map(link => <Link key={link.href} href={link.href} className="settingsDestination"><h2>{link.title}</h2><p>{link.description}</p><strong>Yönetim ekranını aç →</strong></Link>)}</nav>
    </div>
    <style>{`
      .settingsSection{min-height:100vh;background:#f4f7fb;color:#14213d;padding:28px 16px 60px}
      .settingsSectionWrap{max-width:1050px;margin:auto}.settingsSection a{color:#176de9;text-decoration:none}
      .settingsSection header{margin:24px 0}.settingsSection h1{font-size:28px;margin:10px 0}
      .settingsSection p{line-height:1.6;color:#60718b;overflow-wrap:anywhere}
      .settingsSection nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}
      .settingsDestination{display:flex;flex-direction:column;background:white;border:1px solid #dce5f0;border-radius:16px;padding:22px;min-width:0}
      .settingsDestination h2{font-size:18px;color:#14213d;margin:0}.settingsDestination strong{margin-top:auto;padding-top:12px}
      .settingsDestination:hover{border-color:#176de9}.settingsSection a:focus-visible{outline:3px solid #176de9;outline-offset:4px}
    `}</style>
  </main>;
}
