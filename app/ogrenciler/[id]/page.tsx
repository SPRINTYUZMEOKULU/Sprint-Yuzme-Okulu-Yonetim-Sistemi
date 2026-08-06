import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { addStudentNote, updateStudentProfile } from "./actions";
import "./student-detail.css";

export const dynamic = "force-dynamic";

const fmt = (value?: string | null) => value ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const days: Record<number,string> = {0:"Pazar",1:"Pazartesi",2:"Salı",3:"Çarşamba",4:"Perşembe",5:"Cuma",6:"Cumartesi"};

export default async function StudentFile({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<Record<string,string|undefined>> }) {
  await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [{data:student},{data:enrollment},{data:group},{data:branch},{data:notes},{data:timeline},{data:messages},{data:adjustments}] = await Promise.all([
    supabase.from("students").select("*").eq("id",id).single(),
    supabase.from("student_enrollments").select("*").eq("student_id",id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("student_group_memberships").select("group_id").eq("student_id",id).eq("is_active",true).limit(1).maybeSingle(),
    supabase.from("branches").select("id,name,location_url,contact_phone").limit(1).maybeSingle(),
    supabase.from("student_notes").select("id,note_type,body,is_guardian_visible,created_at,author_id").eq("student_id",id).order("created_at",{ascending:false}).limit(20),
    supabase.from("student_timeline_events").select("id,event_type,title,description,event_date").eq("student_id",id).order("event_date",{ascending:false}).limit(30),
    supabase.from("message_logs").select("id,template_key,channel,status,message_body,prepared_at,sent_at").eq("student_id",id).order("prepared_at",{ascending:false}).limit(20),
    supabase.from("student_lesson_adjustments").select("id,adjustment_type,status,lesson_date,reason").eq("student_id",id).order("lesson_date",{ascending:false}).limit(20)
  ]);
  if (!student) notFound();

  let groupInfo:any = null;
  if (group?.group_id) {
    const {data} = await supabase.from("training_groups").select("id,name,course_type,branch_id,primary_coach_id").eq("id",group.group_id).maybeSingle();
    groupInfo = data;
  }
  let branchInfo:any = branch;
  if (groupInfo?.branch_id) {
    const {data} = await supabase.from("branches").select("id,name,location_url,contact_phone").eq("id",groupInfo.branch_id).maybeSingle();
    branchInfo = data;
  }
  let coachName = "—";
  if (groupInfo?.primary_coach_id) {
    const {data} = await supabase.from("profiles").select("full_name").eq("id",groupInfo.primary_coach_id).maybeSingle();
    coachName = data?.full_name || "—";
  }

  const remaining = enrollment ? Math.max(0, Number(enrollment.total_lessons||0)-Number(enrollment.used_lessons||0)) : 0;
  const warningClass = remaining <= 0 ? "danger" : remaining <= 2 ? "warning" : "success";

  return <main className="studentFilePage">
    <header className="studentHero">
      <div className="avatar">{student.first_name?.[0]}{student.last_name?.[0]}</div>
      <div className="heroText"><p>DİJİTAL KURSİYER DOSYASI</p><h1>{student.first_name} {student.last_name}</h1><div className="heroBadges"><span className={`status ${warningClass}`}>{student.status || "aktif"}</span><span>{branchInfo?.name || "Şube atanmadı"}</span><span>{groupInfo?.name || "Grup atanmadı"}</span></div></div>
      <Link className="backButton" href="/ogrenciler">← Öğrencilere Dön</Link>
    </header>

    {query.saved && <div className="notice successNotice">İşlem başarıyla kaydedildi.</div>}
    {query.error && <div className="notice errorNotice">{query.error}</div>}

    <section className="metricGrid">
      <article><span>Toplam Ders</span><strong>{enrollment?.total_lessons ?? "—"}</strong></article>
      <article><span>Kullanılan</span><strong>{enrollment?.used_lessons ?? "—"}</strong></article>
      <article><span>Kalan Ders</span><strong>{enrollment ? remaining : "—"}</strong></article>
      <article><span>Planlanan Bitiş</span><strong>{enrollment?.planned_end_date || "—"}</strong></article>
    </section>

    <div className="twoColumn">
      <section className="panel">
        <div className="panelHead"><div><p>GENEL BİLGİLER</p><h2>Öğrenci ve veli bilgileri</h2></div></div>
        <form action={updateStudentProfile} className="formGrid">
          <input type="hidden" name="student_id" value={student.id}/>
          <label>Telefon<input name="phone" defaultValue={student.phone || ""}/></label>
          <label>E-posta<input name="email" type="email" defaultValue={student.email || ""}/></label>
          <label>Veli Adı Soyadı<input name="guardian_name" defaultValue={student.guardian_name || ""}/></label>
          <label>Veli Telefonu<input name="guardian_phone" defaultValue={student.guardian_phone || ""}/></label>
          <label>Veli E-postası<input name="guardian_email" type="email" defaultValue={student.guardian_email || ""}/></label>
          <label>Acil Durum Kişisi<input name="emergency_contact_name" defaultValue={student.emergency_contact_name || ""}/></label>
          <label>Acil Durum Telefonu<input name="emergency_contact_phone" defaultValue={student.emergency_contact_phone || ""}/></label>
          <label className="full">Genel Not<textarea name="general_note" rows={3} defaultValue={student.general_note || ""}/></label>
          <button className="primaryButton" type="submit">Bilgileri Kaydet</button>
        </form>
      </section>

      <aside className="panel courseCard">
        <div className="panelHead"><div><p>KURS ÖZETİ</p><h2>Aktif kayıt</h2></div></div>
        <div className="infoRows">
          <div><span>Şube</span><strong>{branchInfo?.name || "—"}</strong></div>
          <div><span>Grup</span><strong>{groupInfo?.name || "—"}</strong></div>
          <div><span>Kurs Türü</span><strong>{groupInfo?.course_type || "—"}</strong></div>
          <div><span>Eğitmen</span><strong>{coachName}</strong></div>
          <div><span>Katılım Günleri</span><strong>{(enrollment?.lesson_weekdays || []).map((d:number)=>days[d]).join(" • ") || "—"}</strong></div>
          <div><span>Başlangıç</span><strong>{enrollment?.start_date || "—"}</strong></div>
          <div><span>Planlanan Bitiş</span><strong>{enrollment?.planned_end_date || "—"}</strong></div>
        </div>
      </aside>
    </div>

    <section className="panel">
      <div className="panelHead"><div><p>SAĞLIK BİLGİLERİ</p><h2>Güvenlik ve sağlık notları</h2></div></div>
      <form action={updateStudentProfile} className="formGrid healthGrid">
        <input type="hidden" name="student_id" value={student.id}/>
        <label>Alerji<textarea name="allergy_note" rows={3} defaultValue={student.allergy_note || ""}/></label>
        <label>Kronik Rahatsızlık<textarea name="chronic_condition_note" rows={3} defaultValue={student.chronic_condition_note || ""}/></label>
        <label>Kullanılan İlaçlar<textarea name="medication_note" rows={3} defaultValue={student.medication_note || ""}/></label>
        <label>Acil Müdahale Notu<textarea name="emergency_medical_note" rows={3} defaultValue={student.emergency_medical_note || ""}/></label>
        <button className="primaryButton" type="submit">Sağlık Bilgilerini Kaydet</button>
      </form>
    </section>

    <div className="twoColumn">
      <section className="panel">
        <div className="panelHead"><div><p>NOTLAR</p><h2>Antrenör ve yönetim notları</h2></div></div>
        <form action={addStudentNote} className="noteForm">
          <input type="hidden" name="student_id" value={student.id}/>
          <select name="note_type"><option value="general">Genel</option><option value="coach">Antrenör</option><option value="health">Sağlık</option><option value="finance">Finans</option><option value="crm">CRM</option></select>
          <textarea name="body" rows={4} placeholder="Yeni not yazın..." required/>
          <label className="checkbox"><input type="checkbox" name="is_guardian_visible"/> Veli panelinde göster</label>
          <button className="primaryButton" type="submit">Notu Ekle</button>
        </form>
        <div className="list">{(notes||[]).map((n:any)=><article key={n.id}><div><strong>{n.note_type.toUpperCase()}</strong><p>{n.body}</p></div><span>{fmt(n.created_at)}</span></article>)}{!notes?.length&&<p className="empty">Henüz not yok.</p>}</div>
      </section>

      <section className="panel">
        <div className="panelHead"><div><p>ZAMAN ÇİZGİSİ</p><h2>Öğrencinin işlem geçmişi</h2></div></div>
        <div className="timeline">{(timeline||[]).map((e:any)=><article key={e.id}><i></i><div><strong>{e.title}</strong><p>{e.description || e.event_type}</p><span>{fmt(e.event_date)}</span></div></article>)}{!timeline?.length&&<p className="empty">Henüz zaman çizelgesi kaydı yok.</p>}</div>
      </section>
    </div>

    <div className="twoColumn">
      <section className="panel"><div className="panelHead"><div><p>MESAJ GEÇMİŞİ</p><h2>Veli iletişimi</h2></div></div><div className="list">{(messages||[]).map((m:any)=><article key={m.id}><div><strong>{m.template_key || "Mesaj"}</strong><p>{m.message_body?.slice(0,140)}{m.message_body?.length>140?"…":""}</p></div><span>{m.status} • {fmt(m.sent_at || m.prepared_at)}</span></article>)}{!messages?.length&&<p className="empty">Henüz mesaj kaydı yok.</p>}</div></section>
      <section className="panel"><div className="panelHead"><div><p>TELAFİ VE EK DERSLER</p><h2>Ders düzenlemeleri</h2></div></div><div className="list">{(adjustments||[]).map((a:any)=><article key={a.id}><div><strong>{a.adjustment_type}</strong><p>{a.reason || "Açıklama yok"}</p></div><span>{a.lesson_date} • {a.status}</span></article>)}{!adjustments?.length&&<p className="empty">Henüz telafi veya ek ders yok.</p>}</div></section>
    </div>
  </main>;
}
