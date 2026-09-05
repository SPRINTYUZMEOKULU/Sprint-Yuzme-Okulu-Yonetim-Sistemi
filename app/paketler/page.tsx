import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createPackage, togglePackage, updatePackage } from "./actions";
import "./paketler.css";

export const dynamic = "force-dynamic";

type PackageRow = {
  id: string;
  name: string;
  lesson_count: number;
  price: number;
  course_type: string | null;
  is_active: boolean;
};

const roles = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default async function PackagesPage() {
  const profile = await requireProfile([...roles]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_packages")
    .select("id,name,lesson_count,price,course_type,is_active")
    .eq("organization_id", profile.organization_id)
    .order("is_active", { ascending: false })
    .order("lesson_count", { ascending: true });

  const packages = (data || []) as PackageRow[];
  const active = packages.filter((item) => item.is_active).length;

  return (
    <main className="modulePage">
      <header className="moduleHero">
        <div>
          <p>SPRİNTOS · EĞİTİM VE FİYATLANDIRMA</p>
          <h1>Paket Yönetimi</h1>
          <span>Ders sayısı, ücret ve kurs türlerini tek merkezden yönetin. Aktif paketler ön kayıt ve kesin kayıt ekranlarına otomatik yansır.</span>
        </div>
        <div className="moduleHeroActions">
          <Link href="/">Ana Sayfa</Link>
          <Link href="/on-kayit" className="primary">Ön Kayıt Formunu Aç</Link>
        </div>
      </header>

      <section className="moduleStats">
        <article><span>Toplam Paket</span><strong>{packages.length}</strong><small>Sistemde tanımlı</small></article>
        <article><span>Aktif Paket</span><strong>{active}</strong><small>Kayıtta kullanılabilir</small></article>
        <article><span>Pasif Paket</span><strong>{packages.length - active}</strong><small>Yeni kayıtta gizli</small></article>
      </section>

      <section className="moduleGrid">
        <form action={createPackage} className="moduleCard createCard">
          <div className="cardTitle"><p>YENİ PAKET</p><h2>Paket Oluştur</h2><span>Yeni ders paketi oluşturduğunuzda kayıt ekranlarında kullanılabilir hale gelir.</span></div>
          <label>Paket adı<input name="name" placeholder="Örn. Çocuk 8 Ders" required /></label>
          <div className="twoCols">
            <label>Ders sayısı<input name="lesson_count" type="number" min="1" defaultValue="8" required /></label>
            <label>Ücret (TL)<input name="price" type="number" min="0" step="1" defaultValue="0" required /></label>
          </div>
          <label>Kurs türü<select name="course_type" defaultValue=""><option value="">Genel</option><option value="child">Çocuk</option><option value="adult">Yetişkin</option><option value="team">Takım</option><option value="private">Özel Ders</option></select></label>
          <button className="saveButton">+ Paketi Kaydet</button>
        </form>

        <section className="moduleCard listCard">
          <div className="cardTitle"><p>TANIMLI PAKETLER</p><h2>Aktif ve Pasif Paketler</h2><span>{packages.length ? "Düzenlemek için paket kartını açın." : "Henüz paket bulunmuyor."}</span></div>
          <div className="packageList">
            {packages.map((item) => (
              <article key={item.id} className={item.is_active ? "packageCard" : "packageCard passive"}>
                <div className="packageTop">
                  <div><span>{item.course_type || "Genel"}</span><h3>{item.name}</h3><p>{item.lesson_count} ders · {money(item.price)}</p></div>
                  <b>{item.is_active ? "Aktif" : "Pasif"}</b>
                </div>
                <details>
                  <summary>Bilgileri düzenle</summary>
                  <form action={updatePackage} className="editForm">
                    <input type="hidden" name="id" value={item.id} />
                    <label>Paket adı<input name="name" defaultValue={item.name} required /></label>
                    <div className="twoCols">
                      <label>Ders sayısı<input name="lesson_count" type="number" min="1" defaultValue={item.lesson_count} required /></label>
                      <label>Ücret<input name="price" type="number" min="0" step="1" defaultValue={item.price} required /></label>
                    </div>
                    <label>Kurs türü<select name="course_type" defaultValue={item.course_type || ""}><option value="">Genel</option><option value="child">Çocuk</option><option value="adult">Yetişkin</option><option value="team">Takım</option><option value="private">Özel Ders</option></select></label>
                    <button>Değişiklikleri Kaydet</button>
                  </form>
                </details>
                <form action={togglePackage} className="toggleForm">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="is_active" value={String(!item.is_active)} />
                  <button>{item.is_active ? "Paketi Pasife Al" : "Paketi Aktifleştir"}</button>
                </form>
              </article>
            ))}
            {!packages.length ? <div className="emptyState"><strong>İlk paketinizi oluşturun</strong><span>Soldaki formu doldurup kaydetmeniz yeterli.</span></div> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
