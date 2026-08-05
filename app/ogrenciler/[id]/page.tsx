import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { addLessonAdjustment, updateAttendanceDays } from "./actions";
import "./student-detail.css";

export const dynamic = "force-dynamic";

const weekdays = [
  [1, "Pazartesi"], [2, "Salı"], [3, "Çarşamba"], [4, "Perşembe"],
  [5, "Cuma"], [6, "Cumartesi"], [0, "Pazar"]
] as const;

const typeLabels: Record<string,string> = {
  makeup:"Telafi Dersi", bonus:"Bonus Ders", gift:"Hediye Ders", pool_makeup:"Havuz Kaynaklı Telafi",
  management_extra:"Yönetim Ek Dersi", trial:"Deneme Dersi", private_extra:"Özel Ek Ders", other:"Diğer"
};

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<Record<string,string|undefined>> }) {
  await requireProfile(["owner","admin","branch_manager","registration_staff"]);
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: student }, { data: enrollment }, { data: adjustments }, { data: branches }, { data: groups }, { data: coaches }] = await Promise.all([
    supabase.from("students").select("id,first_name,last_name,status,swimming_level,branch_id").eq("id",id).single(),
    supabase.from("student_enrollments").select("id,start_date,planned_end_date,lesson_weekdays,total_lessons,used_lessons,status,group_id,package_id").eq("student_id",id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("student_lesson_adjustments").select("id,adjustment_type,status,lesson_date,original_lesson_date,start_time,end_time,reason,note,counts_as_package_lesson,increases_total_lessons").eq("student_id",id).order("lesson_date",{ascending:false}).limit(30),
    supabase.from("branches").select("id,name").eq("is_active",true).order("name"),
    supabase.from("training_groups").select("id,name,branch_id").eq("is_active",true).order("name"),
    supabase.from("profiles").select("id,full_name").eq("role","coach").order("full_name")
  ]);

  if (!student) notFound();
  const selectedDays = new Set<number>(enrollment?.lesson_weekdays || []);
  const remaining = enrollment ? Math.max(0, enrollment.total_lessons - enrollment.used_lessons) : 0;

  return <main className="studentDetailPage">
    <header className="studentDetailHeader">
      <div><p>ÖĞRENCİ DOSYASI</p><h1>{student.first_name} {student.last_name}</h1><span>Katılım günleri, telafi ve ek ders işlemlerini yönetin.</span></div>
      <Link className="backButton" href="/ogrenciler">← Öğrencilere Dön</Link>
    </header>
    {query.saved ? <div className="successBanner">İşlem başarıyla kaydedildi.</div> : null}
    {query.error ? <div className="errorBanner">{query.error}</div> : null}

    <div className="detailGrid">
      <section className="detailCard">
        <p className="sectionEyebrow">KATILIM PLANI</p><h2>Öğrencinin Katılacağı Günler</h2>
        <p className="muted">Grup üç gün açık olsa bile öğrenciye özel iki veya üç gün seçebilirsiniz.</p>
        {enrollment ? <form action={updateAttendanceDays}>
          <input type="hidden" name="student_id" value={student.id}/><input type="hidden" name="enrollment_id" value={enrollment.id}/>
          <div className="weekdayGrid">{weekdays.map(([value,label])=><label className="weekdayOption" key={value}><input type="checkbox" name="lesson_weekdays" value={value} defaultChecked={selectedDays.has(value)}/>{label}</label>)}</div>
          <button className="premiumButton" type="submit">Katılım Günlerini Kaydet</button>
        </form> : <p className="muted">Bu öğrenci için aktif paket/kayıt bulunmuyor.</p>}
      </section>

      <aside className="detailCard">
        <p className="sectionEyebrow">PAKET ÖZETİ</p><h2>Aktif Kayıt</h2>
        <div className="summaryList">
          <div className="summaryRow"><span>Toplam Ders</span><strong>{enrollment?.total_lessons ?? "—"}</strong></div>
          <div className="summaryRow"><span>Kullanılan</span><strong>{enrollment?.used_lessons ?? "—"}</strong></div>
          <div className="summaryRow"><span>Kalan</span><strong>{enrollment ? remaining : "—"}</strong></div>
          <div className="summaryRow"><span>Başlangıç</span><strong>{enrollment?.start_date ?? "—"}</strong></div>
          <div className="summaryRow"><span>Planlanan Bitiş</span><strong>{enrollment?.planned_end_date ?? "—"}</strong></div>
        </div>
      </aside>
    </div>

    <section className="detailCard">
      <p className="sectionEyebrow">DERS İŞLEMİ</p><h2>Telafi veya Ek Ders Ekle</h2>
      <p className="muted">Ana grup değişmeden başka tarih, grup veya şubede ders planlayabilirsiniz.</p>
      <form action={addLessonAdjustment} className="formGrid">
        <input type="hidden" name="student_id" value={student.id}/><input type="hidden" name="enrollment_id" value={enrollment?.id || ""}/>
        <div className="formField"><label>Ders Türü</label><select name="adjustment_type" required><option value="makeup">Telafi Dersi</option><option value="bonus">Bonus Ders</option><option value="gift">Hediye Ders</option><option value="pool_makeup">Havuz Kaynaklı Telafi</option><option value="management_extra">Yönetim Ek Dersi</option><option value="trial">Deneme Dersi</option><option value="private_extra">Özel Ek Ders</option><option value="other">Diğer</option></select></div>
        <div className="formField"><label>Ders Tarihi</label><input name="lesson_date" type="date" required/></div>
        <div className="formField"><label>Kaçırılan Ders Tarihi (telafi ise)</label><input name="original_lesson_date" type="date"/></div>
        <div className="formField"><label>Şube</label><select name="branch_id"><option value="">Seçiniz</option>{(branches||[]).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div className="formField"><label>Grup</label><select name="group_id"><option value="">Seçiniz</option>{(groups||[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div className="formField"><label>Eğitmen</label><select name="coach_id"><option value="">Seçiniz</option>{(coaches||[]).map(c=><option key={c.id} value={c.id}>{c.full_name || "İsimsiz Eğitmen"}</option>)}</select></div>
        <div className="formField"><label>Başlangıç Saati</label><input name="start_time" type="time"/></div>
        <div className="formField"><label>Bitiş Saati</label><input name="end_time" type="time"/></div>
        <div className="formField full"><label>Neden / Açıklama</label><textarea name="reason" rows={3} placeholder="Telafi nedeni veya ek ders açıklaması"/></div>
        <div className="checkRows">
          <label><input type="checkbox" name="counts_as_package_lesson"/> Paket dersinden düşsün</label>
          <label><input type="checkbox" name="increases_total_lessons"/> Pakete 1 ders eklensin</label>
          <label><input type="checkbox" name="extends_end_date"/> Planlanan bitiş tarihini uzatsın</label>
        </div>
        <div className="formField full"><button className="premiumButton" type="submit">Dersi Planla</button></div>
      </form>
    </section>

    <section className="detailCard">
      <p className="sectionEyebrow">GEÇMİŞ</p><h2>Telafi ve Ek Ders Kayıtları</h2>
      <div className="historyList">{(adjustments||[]).map(a=><article className="historyItem" key={a.id}><strong>{a.lesson_date}</strong><div><div className="historyType">{typeLabels[a.adjustment_type] || a.adjustment_type}</div><span className="muted">{a.reason || a.note || "Açıklama girilmedi"}</span></div><span className="pill">{a.status}</span></article>)}
      {!adjustments?.length ? <p className="muted">Henüz telafi veya ek ders kaydı bulunmuyor.</p> : null}</div>
    </section>
  </main>;
}
