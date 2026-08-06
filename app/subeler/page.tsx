import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createBranch, toggleBranch, updateBranch } from "./actions";
import "./subeler.css";

export const dynamic = "force-dynamic";

type Branch = {
  id: string; name: string; pool_name: string | null; address: string | null;
  location_url: string | null; contact_phone: string | null; whatsapp_phone: string | null;
  working_hours: string | null; public_registration: boolean; is_active: boolean; sort_order: number;
};

export default async function BranchesPage() {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const supabase = await createClient();
  const { data } = await supabase.from("branches")
    .select("id,name,pool_name,address,location_url,contact_phone,whatsapp_phone,working_hours,public_registration,is_active,sort_order")
    .eq("organization_id", profile.organization_id)
    .order("sort_order").order("name");
  const branches = (data || []) as Branch[];

  return <main className="branchesPage">
    <header className="branchesHeader">
      <div><p>SPRİNTOS · TESİS YÖNETİMİ</p><h1>Şubeler ve Havuzlar</h1><span>Burada aktif olan şubeler, grup oluşturma ve ön kayıt ekranına otomatik yansır.</span></div>
      <div><Link href="/">Dashboard</Link><Link href="/gruplar">Grupları Yönet</Link><Link href="/on-kayit" target="_blank">Formu Aç</Link></div>
    </header>

    <section className="branchGrid">
      <form action={createBranch} className="newBranchCard">
        <div className="sectionTitle"><p>YENİ ŞUBE</p><h2>Şube Oluştur</h2><span>Şube ve iletişim bilgilerini tek yerden yönetin.</span></div>
        <div className="formGrid">
          <label>Şube adı<input name="name" required placeholder="Örn. Konyaaltı Öğretmenevi" /></label>
          <label>Havuz / tesis adı<input name="pool_name" placeholder="Örn. Öğretmenevi Yüzme Havuzu" /></label>
          <label>İletişim telefonu<input name="contact_phone" placeholder="+90 (551) 896 83 19" /></label>
          <label>WhatsApp telefonu<input name="whatsapp_phone" placeholder="+905518968319" /></label>
          <label className="wide">Adres<input name="address" placeholder="Açık adres" /></label>
          <label className="wide">Google Maps bağlantısı<input type="url" name="location_url" placeholder="https://maps.google.com/..." /></label>
          <label>Çalışma saatleri<input name="working_hours" placeholder="Pzt–Paz 09:00–22:00" /></label>
          <label>Sıralama<input name="sort_order" type="number" defaultValue="50" /></label>
        </div>
        <label className="checkLine"><input type="checkbox" name="public_registration" defaultChecked/><span><strong>Ön kayıt formunda göster</strong><small>Şube aktif olsa bile bu seçim kapalıysa veli formunda görünmez.</small></span></label>
        <button className="primaryButton">Şubeyi Kaydet</button>
      </form>

      <section className="branchListCard">
        <div className="sectionTitle"><p>AKTİF TESİSLER</p><h2>Tanımlı Şubeler</h2><span>{branches.length} şube bulunuyor.</span></div>
        <div className="branchCards">
          {branches.map(branch => <article key={branch.id} className={branch.is_active ? "branchCard" : "branchCard passive"}>
            <div className="branchCardTop"><div><span>{branch.public_registration ? "ÖN KAYITTA AÇIK" : "FORMDA GİZLİ"}</span><h3>{branch.name}</h3><p>{branch.pool_name || "Havuz adı eklenmedi"}</p></div><b>{branch.is_active ? "Aktif" : "Pasif"}</b></div>
            <div className="branchMeta">
              <span><small>Telefon</small>{branch.contact_phone || "—"}</span>
              <span><small>Çalışma</small>{branch.working_hours || "—"}</span>
            </div>
            {branch.address ? <p className="addressText">{branch.address}</p> : null}
            <details>
              <summary>Bilgileri düzenle</summary>
              <form action={updateBranch} className="editForm">
                <input type="hidden" name="id" value={branch.id}/>
                <label>Şube adı<input name="name" defaultValue={branch.name} required/></label>
                <label>Havuz adı<input name="pool_name" defaultValue={branch.pool_name || ""}/></label>
                <label>Telefon<input name="contact_phone" defaultValue={branch.contact_phone || ""}/></label>
                <label>WhatsApp<input name="whatsapp_phone" defaultValue={branch.whatsapp_phone || ""}/></label>
                <label className="wide">Adres<input name="address" defaultValue={branch.address || ""}/></label>
                <label className="wide">Google Maps<input name="location_url" type="url" defaultValue={branch.location_url || ""}/></label>
                <label>Çalışma saatleri<input name="working_hours" defaultValue={branch.working_hours || ""}/></label>
                <label>Sıralama<input name="sort_order" type="number" defaultValue={branch.sort_order}/></label>
                <label className="checkLine wide"><input type="checkbox" name="public_registration" defaultChecked={branch.public_registration}/><span>Ön kayıt formunda göster</span></label>
                <button>Değişiklikleri Kaydet</button>
              </form>
            </details>
            <div className="branchActions">
              {branch.location_url ? <a href={branch.location_url} target="_blank" rel="noreferrer">Konumu Aç</a> : <span>Konum eklenmedi</span>}
              <form action={toggleBranch}><input type="hidden" name="id" value={branch.id}/><input type="hidden" name="field" value="public_registration"/><input type="hidden" name="value" value={String(!branch.public_registration)}/><button>{branch.public_registration ? "Formdan Gizle" : "Formda Göster"}</button></form>
              <form action={toggleBranch}><input type="hidden" name="id" value={branch.id}/><input type="hidden" name="field" value="is_active"/><input type="hidden" name="value" value={String(!branch.is_active)}/><button>{branch.is_active ? "Pasife Al" : "Aktifleştir"}</button></form>
            </div>
          </article>)}
          {!branches.length ? <div className="emptyState"><strong>Henüz şube bulunmuyor.</strong><span>Soldaki formdan ilk şubeyi oluşturun.</span></div> : null}
        </div>
      </section>
    </section>
  </main>;
}
