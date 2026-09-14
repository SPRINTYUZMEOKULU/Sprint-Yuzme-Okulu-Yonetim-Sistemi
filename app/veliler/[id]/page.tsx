import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import UstGezinme from "@/app/components/UstGezinme";
import PendingSubmitButton from "@/app/ogrenciler/[id]/pending-submit-button";
import { requireProfile } from "@/lib/auth/profile";
import { updateGuardian } from "../actions";
import {
  addGuardianProgressNote,
  linkGuardianStudentCanonical,
  sendGuardianPortalMessage,
  toggleGuardianProgressVisibility,
  unlinkGuardianStudentCanonical,
} from "./actions";
import StudentSearchSelect from "./student-search-select";
import "../guardian-management.css";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase bağlantısı yok.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function date(v?: string | null) {
  return v
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(v))
    : "—";
}

function friendlyError(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/guardian_students|foreign key|constraint|violates/i.test(raw)) return "Öğrenci bağlantısı oluşturulamadı. Veli hesabı eşleştirmesi kontrol edilip tekrar denenmelidir.";
  if (/duplicate key|unique constraint/i.test(raw)) return "Bu öğrenci bağlantısı zaten mevcut.";
  return raw.length > 220 ? "İşlem tamamlanamadı. Lütfen tekrar deneyin." : raw;
}

export default async function GuardianFile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff"]);
  const { id } = await params;
  const query = await searchParams;
  const admin = adminClient();
  const org = profile.organization_id!;

  const [guardianRes, guardianRecordRes, studentsRes, requestsRes] = await Promise.all([
    admin.from("profiles").select("id,full_name,phone,email,is_active,last_sign_in_at,created_at").eq("organization_id", org).eq("role", "guardian").eq("id", id).maybeSingle(),
    admin.from("guardians").select("id,auth_user_id,login_enabled,is_active").eq("organization_id", org).eq("auth_user_id", id).maybeSingle(),
    admin.from("students").select("id,first_name,last_name,student_number,status,guardian_name,guardian_phone").eq("organization_id", org).eq("is_deleted", false).order("first_name"),
    admin.from("guardian_requests").select("id,request_number,category,subject,status,priority,created_at,updated_at").eq("organization_id", org).eq("guardian_id", id).order("created_at", { ascending: false }).limit(30),
  ]);

  const guardian = guardianRes.data;
  if (!guardian) notFound();

  const canonicalGuardianId = guardianRecordRes.data?.id || "";
  const linksRes = canonicalGuardianId
    ? await admin.from("guardian_students").select("guardian_id,student_id,relationship,is_primary,is_payment_contact,receives_messages,portal_access,is_emergency_contact,created_at").eq("guardian_id", canonicalGuardianId)
    : { data: [] as any[], error: null };
  const links = linksRes.data || [];
  const students = studentsRes.data || [];
  const studentMap = new Map(students.map((s: any) => [s.id, s]));
  const linkedIds = links.map((l: any) => l.student_id).filter(Boolean);
  const linkedIdSet = new Set(linkedIds);
  const visibleError = friendlyError(query.error);

  const [progressRes, messagesRes, announcementRes] = await Promise.all([
    linkedIds.length
      ? admin.from("progress_notes").select("id,student_id,note,target,visible_to_guardian,created_at,coach_id").in("student_id", linkedIds).order("created_at", { ascending: false }).limit(60)
      : Promise.resolve({ data: [] as any[], error: null }),
    admin.from("guardian_messages").select("id,student_id,title,body,message_type,channel,sent_at,read_at,created_at").eq("organization_id", org).eq("guardian_id", id).order("created_at", { ascending: false }).limit(60),
    admin.from("announcements").select("id,title,body,audience,is_published,published_at,created_at").eq("is_published", true).order("published_at", { ascending: false }).limit(10),
  ]);

  const progress = progressRes.data || [];
  const messages = messagesRes.data || [];
  const announcements = announcementRes.data || [];
  const visibleProgressCount = progress.filter((p: any) => p.visible_to_guardian).length;
  const unreadMessageCount = messages.filter((m: any) => !m.read_at).length;
  const portalEnabled = guardian.is_active !== false && guardianRecordRes.data?.is_active !== false && guardianRecordRes.data?.login_enabled !== false;

  const childName = (studentId?: string | null) => {
    if (!studentId) return "Tüm bağlı öğrenciler";
    const s: any = studentMap.get(studentId);
    return s ? `${s.first_name} ${s.last_name}` : "Öğrenci";
  };

  return <>
    <UstGezinme />
    <main className="guardianAdminPage">
      <div className="guardianAdminWrap">
        <header className="guardianHero">
          <div>
            <small>SPRİNTOS · DİJİTAL VELİ DOSYASI</small>
            <h1>{guardian.full_name || "Veli Hesabı"}</h1>
            <p>{guardian.phone || "Telefon yok"} · Son giriş: {date(guardian.last_sign_in_at)}</p>
          </div>
          <div className="guardianHeroActions">
            <Link href="/veliler">Velilere Dön</Link>
            <Link className="primary" href={`/veli-talepleri?guardian=${id}`}>Talepleri Aç</Link>
          </div>
        </header>

        {query.saved ? <div className="guardianNotice">{query.saved}</div> : null}
        {visibleError ? <div className="guardianNotice error">{visibleError}</div> : null}
        {!canonicalGuardianId ? <div className="guardianNotice error">Portal hesabının ana veli kaydı bulunamadı. Öğrenci bağlantısı oluşturulmadan önce hesap kaydı eşleştirilmelidir.</div> : null}

        <div className="guardianDetailGrid">
          <section className="guardianPanel">
            <div className="guardianEyebrow">HESAP VE GÜVENLİK</div>
            <h2>Veli bilgileri</h2>
            <form action={updateGuardian} className="guardianForm">
              <input type="hidden" name="guardian_id" value={id} />
              <label>Ad Soyad<input name="full_name" defaultValue={guardian.full_name || ""} required /></label>
              <label>Telefon<input name="phone" defaultValue={guardian.phone || ""} /></label>
              <div className="guardianChecks"><label><input type="checkbox" name="is_active" defaultChecked={guardian.is_active} /> Portal hesabı aktif</label></div>
              <PendingSubmitButton className="guardianButton primary" pendingText="Bilgiler kaydediliyor…">Bilgileri Kaydet</PendingSubmitButton>
            </form>
            <div className="guardianChild" style={{ marginTop: 14 }}>
              <span><b>Oluşturulma</b><small>{date(guardian.created_at)}</small></span>
              <span><b>Son giriş</b><small>{date(guardian.last_sign_in_at)}</small></span>
            </div>
          </section>

          <section className="guardianPanel">
            <div className="guardianEyebrow">ÖĞRENCİ BAĞLANTILARI</div>
            <h2>Bağlı öğrenciler</h2>
            <div className="guardianChildren">
              {links.map((l: any) => {
                const s: any = studentMap.get(l.student_id);
                return <div className="guardianChild" key={l.student_id}>
                  <span>
                    <b>{s ? `${s.first_name} ${s.last_name}` : "Öğrenci"}</b>
                    <small>{s?.student_number || "Numara yok"} · {l.relationship || "Veli"} · {l.portal_access ? "Portal açık" : "Portal kapalı"}</small>
                  </span>
                  <span>
                    <Link href={`/ogrenciler/${l.student_id}`}>Dosyayı Aç</Link>
                    {["owner", "admin"].includes(profile.role) ? <form action={unlinkGuardianStudentCanonical}>
                      <input type="hidden" name="guardian_profile_id" value={id} />
                      <input type="hidden" name="student_id" value={l.student_id} />
                      <button className="deleteNoteButton">Bağı Kaldır</button>
                    </form> : null}
                  </span>
                </div>;
              })}
              {!links.length ? <div className="guardianChild"><small>Henüz öğrenci bağlantısı yok.</small></div> : null}
            </div>
            <form action={linkGuardianStudentCanonical} className="guardianForm" style={{ marginTop: 18 }}>
              <input type="hidden" name="guardian_profile_id" value={id} />
              <StudentSearchSelect students={students.filter((s: any) => !linkedIdSet.has(s.id)).map((s: any) => ({ id: s.id, name: `${s.first_name || ""} ${s.last_name || ""}`.trim(), number: s.student_number || "" }))} />
              <label>Yakınlık<select name="relationship"><option>Anne</option><option>Baba</option><option>Yasal Vasi</option><option>Kendisi</option><option>Acil Durum Kişisi</option><option>Diğer</option></select></label>
              <div className="guardianChecks">
                <label><input type="checkbox" name="is_primary" /> Birincil veli</label>
                <label><input type="checkbox" name="is_payment_contact" /> Ödeme sorumlusu</label>
                <label><input type="checkbox" name="receives_messages" defaultChecked /> Mesajları alsın</label>
                <label><input type="checkbox" name="portal_access" defaultChecked /> Portal erişimi</label>
                <label><input type="checkbox" name="is_emergency_contact" /> Acil durumda ara</label>
              </div>
              <PendingSubmitButton className="guardianButton primary" pendingText="Bağlantı kaydediliyor…">Öğrenciyi Bağla</PendingSubmitButton>
            </form>
          </section>
        </div>

        <section className="guardianPanel" style={{ marginTop: 16 }}>
          <div className="guardianCardHead">
            <div><div className="guardianEyebrow">VELİ PORTAL YÖNETİMİ</div><h2>Veli ne görüyor?</h2></div>
            <span className="guardianPill">{portalEnabled ? "Portal Aktif" : "Portal Pasif"}</span>
          </div>
          <div className="guardianDetailGrid">
            <div className="guardianChild"><span><b>{links.filter((l: any) => l.portal_access).length}</b><small>Portala açık öğrenci</small></span></div>
            <div className="guardianChild"><span><b>{visibleProgressCount}</b><small>Veliye açık gelişim notu</small></span></div>
            <div className="guardianChild"><span><b>{messages.length}</b><small>Portal mesajı · {unreadMessageCount} okunmamış</small></span></div>
            <div className="guardianChild"><span><b>{announcements.length}</b><small>Yayındaki genel duyuru</small></span></div>
          </div>
          <div className="guardianNotice" style={{ marginTop: 14 }}>
            Veli portalında yalnızca portal erişimi açık öğrenciler, veliyle paylaşılmış gelişim notları, bu veliye gönderilen mesajlar ve yayınlanmış duyurular görünür.
          </div>
        </section>

        <div className="guardianDetailGrid" style={{ marginTop: 16 }}>
          <section className="guardianPanel">
            <div className="guardianEyebrow">GELİŞİM MERKEZİ</div>
            <h2>Gelişim notu ekle</h2>
            <form action={addGuardianProgressNote} className="guardianForm">
              <input type="hidden" name="guardian_profile_id" value={id} />
              <label>Öğrenci<select name="student_id" required defaultValue=""><option value="" disabled>Öğrenci seçin</option>{links.map((l: any) => <option key={l.student_id} value={l.student_id}>{childName(l.student_id)}</option>)}</select></label>
              <label>Gelişim Notu<textarea name="note" rows={5} placeholder="Teknik gelişim, dersteki ilerleme, dikkat edilmesi gereken konu..." required /></label>
              <label>Sonraki Hedef<textarea name="target" rows={3} placeholder="Örn. nefes koordinasyonu, serbest stil kol tekniği..." /></label>
              <div className="guardianChecks"><label><input type="checkbox" name="visible_to_guardian" defaultChecked /> Veli portalında göster</label></div>
              <PendingSubmitButton className="guardianButton primary" pendingText="Gelişim notu kaydediliyor…">Gelişim Notunu Kaydet</PendingSubmitButton>
            </form>
          </section>

          <section className="guardianPanel">
            <div className="guardianEyebrow">MESAJ MERKEZİ</div>
            <h2>Veliye portal mesajı gönder</h2>
            <form action={sendGuardianPortalMessage} className="guardianForm">
              <input type="hidden" name="guardian_profile_id" value={id} />
              <label>İlgili Öğrenci<select name="student_id" defaultValue=""><option value="">Genel veli mesajı</option>{links.map((l: any) => <option key={l.student_id} value={l.student_id}>{childName(l.student_id)}</option>)}</select></label>
              <label>Mesaj Türü<select name="message_type" defaultValue="information"><option value="information">Bilgilendirme</option><option value="progress">Gelişim</option><option value="payment">Ödeme</option><option value="schedule">Program / Seans</option><option value="warning">Önemli Uyarı</option></select></label>
              <label>Başlık<input name="title" placeholder="Mesaj başlığı" required /></label>
              <label>Mesaj<textarea name="body" rows={6} placeholder="Veli portalında gösterilecek mesajı yazın..." required /></label>
              <PendingSubmitButton className="guardianButton primary" pendingText="Mesaj gönderiliyor…">Portala Mesaj Gönder</PendingSubmitButton>
            </form>
          </section>
        </div>

        <div className="guardianDetailGrid" style={{ marginTop: 16 }}>
          <section className="guardianPanel">
            <div className="guardianCardHead"><div><div className="guardianEyebrow">GELİŞİM GEÇMİŞİ</div><h2>Son gelişim notları</h2></div></div>
            <div className="guardianRequestList">
              {progress.slice(0, 12).map((n: any) => <article className="guardianRequest" key={n.id}>
                <div className="guardianRequestHead"><div><small>{childName(n.student_id)}</small><h3>{n.target || "Gelişim Notu"}</h3></div><span className="guardianPill">{n.visible_to_guardian ? "Veli görüyor" : "Yönetim notu"}</span></div>
                <p style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>{n.note}</p>
                <div className="guardianRequestMeta"><span>{date(n.created_at)}</span></div>
                <form action={toggleGuardianProgressVisibility} style={{ marginTop: 10 }}>
                  <input type="hidden" name="guardian_profile_id" value={id} />
                  <input type="hidden" name="student_id" value={n.student_id} />
                  <input type="hidden" name="note_id" value={n.id} />
                  <button className="guardianButton">{n.visible_to_guardian ? "Veli Portalından Gizle" : "Veliyle Paylaş"}</button>
                </form>
              </article>)}
              {!progress.length ? <div className="guardianEmpty">Henüz gelişim notu yok.</div> : null}
            </div>
          </section>

          <section className="guardianPanel">
            <div className="guardianCardHead"><div><div className="guardianEyebrow">MESAJ GEÇMİŞİ</div><h2>Veliye gönderilenler</h2></div></div>
            <div className="guardianRequestList">
              {messages.slice(0, 12).map((m: any) => <article className="guardianRequest" key={m.id}>
                <div className="guardianRequestHead"><div><small>{childName(m.student_id)}</small><h3>{m.title}</h3></div><span className="guardianPill">{m.read_at ? "Okundu" : "Okunmadı"}</span></div>
                <p style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>{m.body}</p>
                <div className="guardianRequestMeta"><span>{m.message_type}</span><span>{date(m.sent_at || m.created_at)}</span></div>
              </article>)}
              {!messages.length ? <div className="guardianEmpty">Bu veliye henüz portal mesajı gönderilmemiş.</div> : null}
            </div>
          </section>
        </div>

        <section className="guardianPanel" style={{ marginTop: 16 }}>
          <div className="guardianCardHead">
            <div><div className="guardianEyebrow">TALEP VE GÖRÜŞ GEÇMİŞİ</div><h2>Veli talepleri</h2></div>
            <Link className="guardianButton" href={`/veli-talepleri?guardian=${id}`}>Tümünü Yönet</Link>
          </div>
          <div className="guardianRequestList">
            {(requestsRes.data || []).map((r: any) => <article className={`guardianRequest ${r.priority}`} key={r.id}>
              <div className="guardianRequestHead"><div><small>{r.request_number}</small><h3>{r.subject}</h3></div><span className="guardianPill">{r.status}</span></div>
              <div className="guardianRequestMeta"><span>{r.category}</span><span>{r.priority}</span><span>{date(r.created_at)}</span></div>
            </article>)}
            {requestsRes.error ? <div className="guardianNotice error">Talep modülü için 015 SQL kurulumu gereklidir.</div> : null}
            {!requestsRes.data?.length && !requestsRes.error ? <div className="guardianEmpty">Henüz veli talebi bulunmuyor.</div> : null}
          </div>
        </section>
      </div>
    </main>
  </>;
}
