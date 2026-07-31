import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile, type UserRole } from "@/lib/auth/profile";

export const dynamic = "force-dynamic";

type Section = { title: string; description: string; roles: UserRole[] };
const management: UserRole[] = ["owner","admin","branch_manager"];
const staff: UserRole[] = ["owner","admin","branch_manager","registration_staff","accounting","coach"];

const sections: Record<string, Section> = {
  ogrenciler: { title: "Öğrenciler", description: "Öğrenci kayıtları, durumları ve grup atamaları burada yönetilecek.", roles: staff },
  veliler: { title: "Veliler", description: "Veli iletişim bilgileri ve öğrenci bağlantıları burada yönetilecek.", roles: ["owner","admin","branch_manager","registration_staff"] },
  gruplar: { title: "Gruplar", description: "Şube, seviye, kontenjan ve antrenör atamaları burada yönetilecek.", roles: staff },
  "ders-programi": { title: "Ders Programı", description: "Yetkinize göre ders programınız burada görüntülenecek.", roles: ["owner","admin","branch_manager","registration_staff","accounting","coach","guardian"] },
  yoklama: { title: "Yoklama ve Derse Geldim", description: "Öğrenci yoklaması ve eğitmen ders katılım kayıtları burada tutulacak.", roles: ["owner","admin","branch_manager","coach"] },
  paketler: { title: "Paketler", description: "Ders sayısı, günler ve otomatik bitiş tarihi burada yönetilecek.", roles: ["owner","admin","branch_manager","registration_staff","accounting","guardian"] },
  odemeler: { title: "Ödemeler", description: "Aidat, ödeme ve gecikme takibi burada yapılacak.", roles: ["owner","admin","branch_manager","accounting","guardian"] },
  "hazir-mesajlar": { title: "Hazır Mesajlar", description: "Kayıt onayı, malzeme listesi ve diğer hazır mesajlar burada kullanılacak.", roles: staff },
  uyarilar: { title: "Uyarılar", description: "Yetkinize uygun sistem uyarıları burada görüntülenecek.", roles: ["owner","admin","branch_manager","registration_staff","accounting","coach","guardian"] },
  "onay-merkezi": { title: "Onay Merkezi", description: "İndirim, telafi, paket uzatma ve düzeltme talepleri burada onaylanacak.", roles: management },
  notlar: { title: "Notlar", description: "Kişisel ve ekip notları burada tutulacak.", roles: staff },
  raporlar: { title: "Raporlar", description: "Öğrenci, şube, ödeme ve hoca ders raporları burada görüntülenecek.", roles: management },
  ayarlar: { title: "Ayarlar", description: "Kurum, kullanıcı, şube ve sistem ayarları burada yönetilecek.", roles: ["owner","admin"] }
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const profile = await requireProfile();
  const { section } = await params;
  const current = sections[section];
  if (!current) notFound();
  if (!current.roles.includes(profile.role)) redirect("/yetkisiz");

  return (
    <main className="registrationPage">
      <section className="registrationCard">
        <div className="registrationHeader">
          <div><p className="eyebrow">SPRİNT YÜZME OKULU</p><h1>{current.title}</h1><p>{current.description}</p></div>
          <Link href="/" className="secondaryLink">Yönetim paneline dön</Link>
        </div>
        <div className="panel"><div className="emptyState"><strong>{current.title} modülü güvenli biçimde açıldı</strong><span>Bir sonraki aşamada bu ekran gerçek Supabase verileriyle çalışacak.</span></div></div>
      </section>
    </main>
  );
}
