import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import UstGezinme from "@/app/components/UstGezinme";
import PendingSubmitButton from "@/app/ogrenciler/[id]/pending-submit-button";
import { requireProfile } from "@/lib/auth/profile";
import { createAnnouncement, createGuardianDocument, toggleAnnouncement, toggleGuardianDocument } from "./actions";
import "../guardian-management.css";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase bağlantısı yok.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function date(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value))
    : "—";
}

export default async function GuardianContentManagement({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
  const query = await searchParams;
  const org = profile.organization_id!;
  const admin = adminClient();

  const [announcementsRes, documentsRes, guardiansRes, messagesRes, branchesRes, groupsRes] = await Promise.all([
    admin.from("announcements").select("id,title,body,audience,branch_id,group_id,is_published,published_at,created_at").eq("organization_id", org).order("created_at", { ascending: false }).limit(50),
    admin.from("guardian_documents").select("id,title,summary,document_type,requires_consent,is_active,version,created_at").eq("organization_id", org).order("sort_order").order("created_at", { ascending: false }).limit(50),
    admin.from("profiles").select("id").eq("organization_id", org).eq("role", "guardian").eq("is_active", true),
    admin.from("guardian_messages").select("id,read_at").eq("organization_id", org).limit(5000),
    admin.from("branches").select("id,name,is_active").eq("organization_id", org).eq("is_active", true).order("name"),
    admin.from("training_groups").select("id,name,branch_id,is_active").eq("organization_id", org).eq("is_active", true).order("name"),
  ]);

  const announcements = announcementsRes.data || [];
  const documents = documentsRes.data || [];
  const messages = messagesRes.data || [];
  const branches = branchesRes.data || [];
  const groups = groupsRes.data || [];
  const branchMap = new Map(branches.map((b: any) => [b.id, b.name]));
  const groupMap = new Map(groups.map((g: any) => [g.id, g.name]));
  const canPublishAnnouncements = ["owner", "admin", "branch_manager"].includes(profile.role);
  const canManageDocuments = ["owner", "admin"].includes(profile.role);

  return <>
    <UstGezinme />
    <main className="guardianAdminPage">
      <div className="guardianAdminWrap">
        <header className="guardianHero">
          <div>
            <small>SPRİNTOS · VELİ PORTALI</small>
            <h1>Portal İçerik Yönetimi</h1>
            <p>Velilerin portalda gördüğü duyuru, belge ve bireysel mesaj alanlarını tek merkezden yönetin.</p>
          </div>
          <div className="guardianHeroActions">
            <Link href="/veliler">Veli Merkezine Dön</Link>
            <Link className="primary" href="/veli-paneli">Veli Portalını Aç</Link>
          </div>
        </header>

        {query.saved ? <div className="guardianNotice">{query.saved}</div> : null}
        {query.error ? <div className="guardianNotice error">{query.error}</div> : null}

        <section className="guardianStats">
          <article className="guardianStat"><span>Aktif Veli Hesabı</span><strong>{guardiansRes.data?.length || 0}</strong></article>
          <article className="guardianStat"><span>Yayındaki Duyuru</span><strong>{announcements.filter((a: any) => a.is_published).length}</strong></article>
          <article className="guardianStat"><span>Portal Belgesi</span><strong>{documents.filter((d: any) => d.is_active).length}</strong></article>
          <article className="guardianStat"><span>Portal Mesajı</span><strong>{messages.length}</strong></article>
          <article className="guardianStat"><span>Okunmamış Mesaj</span><strong>{messages.filter((m: any) => !m.read_at).length}</strong></article>
          <article className="guardianStat"><span>Otomatik Alanlar</span><strong>3</strong><small style={{display:"block",marginTop:4,color:"#7a899e"}}>Program · Yoklama · Ödeme</small></article>
        </section>

        <section className="guardianPanel" style={{ marginBottom: 16 }}>
          <div className="guardianEyebrow">PORTAL SENKRONİZASYONU</div>
          <h2>Hangi alan nereden yönetiliyor?</h2>
          <div className="guardianDetailGrid">
            <div className="guardianChild portalSyncRow"><span><b>Duyurular</b><small>Genel, şube veya grup bazında yayınlanabilir.</small></span><span className="guardianPill compact">Manuel</span></div>
            <div className="guardianChild portalSyncRow"><span><b>Mesajlar & Gelişim</b><small>Veli dosyasından kişiye/öğrenciye özel gönderilir.</small></span><Link className="portalManageButton" href="/veliler"><span>Veli Dosyalarını Yönet</span><b>→</b></Link></div>
            <div className="guardianChild portalSyncRow"><span><b>Kurallar & Belgeler</b><small>Bu ekrandan yayınlanır; onay gerektiren belge işaretlenebilir.</small></span><span className="guardianPill compact">Manuel</span></div>
            <div className="guardianChild portalSyncRow"><span><b>Program · Yoklama · Ödeme</b><small>Mevcut SprintOS kayıtlarından otomatik gelir; burada tekrar girilmez.</small></span><span className="guardianPill compact">Otomatik</span></div>
          </div>
        </section>

        <div className="guardianDetailGrid">
          <section className="guardianPanel">
            <div className="guardianEyebrow">DUYURU YAYINLA</div>
            <h2>Veli portalı duyurusu</h2>
            {canPublishAnnouncements ? <form action={createAnnouncement} className="guardianForm">
              <div className="portalAudienceBox"><div><strong>Kimler görecek?</strong><small>Boş bırakırsanız tüm aktif velilere yayınlanır.</small></div><div className="portalAudienceGrid"><label>Şube<select name="branch_id" defaultValue=""><option value="">Tüm şubeler</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Grup<select name="group_id" defaultValue=""><option value="">Tüm gruplar</option>{groups.map((g:any)=><option key={g.id} value={g.id}>{branchMap.get(g.branch_id)||"Şube"} · {g.name}</option>)}</select></label></div></div>
              <label>Başlık<input name="title" placeholder="Örn. Havuz bakım duyurusu" required /></label>
              <label>Duyuru Metni<textarea name="body" rows={7} placeholder="Velilerin portalda göreceği bilgilendirmeyi yazın..." required /></label>
              <div className="guardianChecks"><label><input type="checkbox" name="is_published" defaultChecked /> Hemen yayınla</label></div>
              <PendingSubmitButton className="guardianButton primary" pendingText="Duyuru kaydediliyor…">Duyuruyu Kaydet</PendingSubmitButton>
            </form> : <div className="guardianNotice">Duyuru yayınlama yetkisi yönetici veya şube yöneticisindedir.</div>}
          </section>

          <section className="guardianPanel">
            <div className="guardianEyebrow">BELGE / KURAL YAYINLA</div>
            <h2>Kurallar & belgeler</h2>
            {canManageDocuments ? <form action={createGuardianDocument} className="guardianForm">
              <label>Başlık<input name="title" placeholder="Örn. Kayıt ve Kurs Kuralları" required /></label>
              <label>Kısa Açıklama<input name="summary" placeholder="Belgenin veliye kısa açıklaması" /></label>
              <label>Belge Türü<select name="document_type" defaultValue="information"><option value="information">Bilgilendirme</option><option value="course_rules">Kurs Kuralları</option><option value="payment_policy">Ödeme Politikası</option><option value="kvkk">KVKK</option><option value="pool_rules">Havuz Kuralları</option></select></label>
              <label>İçerik<textarea name="body" rows={6} placeholder="Veli portalında gösterilecek metin..." required /></label>
              <div className="guardianChecks">
                <label><input type="checkbox" name="is_active" defaultChecked /> Portalda aktif</label>
                <label><input type="checkbox" name="requires_consent" /> Veli onayı gerektirir</label>
              </div>
              <PendingSubmitButton className="guardianButton primary" pendingText="Belge kaydediliyor…">Belgeyi Kaydet</PendingSubmitButton>
            </form> : <div className="guardianNotice">Belge yönetimi yalnızca yönetici hesaplarında açıktır.</div>}
          </section>
        </div>

        <div className="guardianDetailGrid" style={{ marginTop: 16 }}>
          <section className="guardianPanel">
            <div className="guardianCardHead"><div><div className="guardianEyebrow">DUYURU GEÇMİŞİ</div><h2>Yayınlar</h2></div></div>
            <div className="guardianRequestList">
              {announcements.map((a: any) => <article className="guardianRequest" key={a.id}>
                <div className="guardianRequestHead"><div><small>{date(a.published_at || a.created_at)}</small><h3>{a.title}</h3><div className="guardianRequestMeta"><span>{a.group_id ? `Grup: ${groupMap.get(a.group_id)||"Seçili grup"}` : a.branch_id ? `Şube: ${branchMap.get(a.branch_id)||"Seçili şube"}` : "Tüm aktif veliler"}</span></div></div><span className={"guardianPill " + (a.is_published ? "" : "off")}>{a.is_published ? "Yayında" : "Taslak / Pasif"}</span></div>
                <p style={{whiteSpace:"pre-wrap"}}>{a.body}</p>
                {canPublishAnnouncements ? <form action={toggleAnnouncement}><input type="hidden" name="id" value={a.id}/><button className="guardianButton">{a.is_published ? "Portaldan Kaldır" : "Şimdi Yayınla"}</button></form> : null}
              </article>)}
              {!announcements.length ? <div className="guardianEmpty">Henüz duyuru oluşturulmamış.</div> : null}
            </div>
          </section>

          <section className="guardianPanel">
            <div className="guardianCardHead"><div><div className="guardianEyebrow">BELGE GEÇMİŞİ</div><h2>Portal belgeleri</h2></div></div>
            <div className="guardianRequestList">
              {documents.map((d: any) => <article className="guardianRequest" key={d.id}>
                <div className="guardianRequestHead"><div><small>{d.document_type} · v{d.version}</small><h3>{d.title}</h3></div><span className={"guardianPill " + (d.is_active ? "" : "off")}>{d.is_active ? "Aktif" : "Pasif"}</span></div>
                {d.summary ? <p>{d.summary}</p> : null}
                <div className="guardianRequestMeta"><span>{d.requires_consent ? "Veli onayı gerekli" : "Bilgilendirme"}</span><span>{date(d.created_at)}</span></div>
                {canManageDocuments ? <form action={toggleGuardianDocument} style={{marginTop:10}}><input type="hidden" name="id" value={d.id}/><button className="guardianButton">{d.is_active ? "Portaldan Kaldır" : "Portala Yayınla"}</button></form> : null}
              </article>)}
              {!documents.length ? <div className="guardianEmpty">Henüz portal belgesi oluşturulmamış.</div> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  </>;
}
