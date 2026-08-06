"use client";

import { useMemo, useState } from "react";
import { completeRegistration } from "./actions";

type Branch = { id: string; name: string; location_url: string | null; contact_phone: string | null; material_list: string | null };
type Group = { id: string; name: string; branch_id: string; course_type: string; primary_coach_id: string | null; schedules: Array<{ weekday: number; start_time: string; end_time: string }> };
type Package = { id: string; name: string; lesson_count: number; price: number };
type Coach = { id: string; full_name: string | null };

type Props = {
  student: { id: string; first_name: string; last_name: string; guardian_name: string | null; guardian_phone: string | null };
  branches: Branch[];
  groups: Group[];
  packages: Package[];
  coaches: Coach[];
  template: string;
};

const dayNames: Record<number, string> = { 0: "Pazar", 1: "Pazartesi", 2: "Salı", 3: "Çarşamba", 4: "Perşembe", 5: "Cuma", 6: "Cumartesi" };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
}

function calculateEndDate(start: string, weekdays: number[], lessonCount: number) {
  if (!start || !weekdays.length || lessonCount < 1) return null;
  const date = new Date(`${start}T12:00:00`);
  let count = 0;
  let guard = 0;
  while (count < lessonCount && guard < 730) {
    if (weekdays.includes(date.getDay())) count += 1;
    if (count < lessonCount) date.setDate(date.getDate() + 1);
    guard += 1;
  }
  return date.toISOString().slice(0, 10);
}

function fillTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value || "—"), template);
}

export default function RegistrationWizard({ student, branches, groups, packages, coaches, template }: Props) {
  const [branchId, setBranchId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [lessonCount, setLessonCount] = useState(8);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const availableGroups = groups.filter((group) => !branchId || group.branch_id === branchId);
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedPackage = packages.find((item) => item.id === packageId);
  const selectedCoach = coaches.find((coach) => coach.id === (coachId || selectedGroup?.primary_coach_id || ""));
  const endDate = useMemo(() => calculateEndDate(startDate, weekdays, lessonCount), [startDate, weekdays, lessonCount]);

  const timeText = selectedGroup?.schedules?.length
    ? `${selectedGroup.schedules[0].start_time.slice(0, 5)} - ${selectedGroup.schedules[0].end_time.slice(0, 5)}`
    : "—";

  const variables = useMemo(() => ({
    veli_adi: student.guardian_name || "Değerli Velimiz",
    ogrenci_adi: `${student.first_name} ${student.last_name}`,
    sube: selectedBranch?.name || "—",
    kurs_turu: selectedGroup?.course_type || "—",
    grup: selectedGroup?.name || "—",
    gunler: weekdays.map((day) => dayNames[day]).join(" - ") || "—",
    saat: timeText,
    paket: selectedPackage ? `${selectedPackage.name} (${selectedPackage.lesson_count} Ders)` : `${lessonCount} Ders`,
    baslangic: formatDate(startDate),
    bitis: formatDate(endDate),
    egitmen: selectedCoach?.full_name || "Sprint Yüzme Okulu Antrenörü",
    malzemeler: selectedBranch?.material_list || "• Yüzme mayosu\n• Havlu\n• Terlik\n• Havuz gözlüğü\n• Sprint Yüzme Okulu bonesi tarafımızdan hediye edilecektir.",
    konum: selectedBranch?.location_url || "Konum bilgisi kayıt sonrasında paylaşılacaktır.",
    telefon: selectedBranch?.contact_phone || "+90 (551) 896 83 19"
  }), [student, selectedBranch, selectedGroup, selectedPackage, selectedCoach, weekdays, timeText, lessonCount, startDate, endDate]);

  function generateMessage() {
    setMessage(fillTemplate(template, variables));
  }

  function handleGroupChange(value: string) {
    setGroupId(value);
    const group = groups.find((item) => item.id === value);
    if (group) {
      setBranchId(group.branch_id);
      setCoachId(group.primary_coach_id || "");
      setWeekdays(group.schedules.map((item) => item.weekday));
    }
  }

  function handlePackageChange(value: string) {
    setPackageId(value);
    const selected = packages.find((item) => item.id === value);
    if (selected) setLessonCount(selected.lesson_count);
  }

  async function copyMessage() {
    if (!message) generateMessage();
    const text = message || fillTemplate(template, variables);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const whatsappUrl = `https://wa.me/${(student.guardian_phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(message || fillTemplate(template, variables))}`;

  return <form action={completeRegistration} className="wizardGrid">
    <input type="hidden" name="student_id" value={student.id} />
    <input type="hidden" name="total_lessons" value={lessonCount} />
    <input type="hidden" name="message_body" value={message || fillTemplate(template, variables)} />
    <input type="hidden" name="recipient" value={student.guardian_phone || ""} />

    <section className="wizardCard">
      <p className="eyebrow">1 · KAYIT BİLGİLERİ</p>
      <h2>Grup, Paket ve Takvim</h2>
      <div className="formGrid">
        <label>Şube<select name="branch_id" value={branchId} onChange={(event) => { setBranchId(event.target.value); setGroupId(""); setWeekdays([]); }} required><option value="">Şube seçiniz</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label>Grup<select name="group_id" value={groupId} onChange={(event) => handleGroupChange(event.target.value)} required><option value="">Grup seçiniz</option>{availableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label>Paket<select name="package_id" value={packageId} onChange={(event) => handlePackageChange(event.target.value)}><option value="">Paket seçiniz</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.lesson_count} Ders</option>)}</select></label>
        <label>Eğitmen<select name="coach_id" value={coachId} onChange={(event) => setCoachId(event.target.value)}><option value="">Grup eğitmeni</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.full_name || "İsimsiz Eğitmen"}</option>)}</select></label>
        <label>Başlangıç Tarihi<input name="start_date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
        <label>Planlanan Bitiş<input value={endDate || ""} readOnly placeholder="Günler seçilince hesaplanır" /></label>
      </div>
      <div className="dayPicker">
        <span>Öğrencinin katılacağı günler</span>
        <div>{Object.entries(dayNames).map(([value, label]) => { const day = Number(value); return <label key={value} className={weekdays.includes(day) ? "selected" : ""}><input type="checkbox" name="lesson_weekdays" value={day} checked={weekdays.includes(day)} onChange={(event) => setWeekdays((current) => event.target.checked ? [...current, day].sort() : current.filter((item) => item !== day))} />{label}</label>; })}</div>
      </div>
      <div className="dateSummary"><span>Başlangıç<strong>{formatDate(startDate)}</strong></span><span>Bitiş<strong>{formatDate(endDate)}</strong></span><span>Ders Sayısı<strong>{lessonCount}</strong></span></div>
    </section>

    <section className="wizardCard">
      <p className="eyebrow">2 · KONTROL LİSTESİ</p>
      <h2>Kayıt Tamamlama Standardı</h2>
      <div className="checklist">
        <label><input type="checkbox" name="payment_received" /> Ödeme alındı</label>
        <label><input type="checkbox" name="health_declaration_received" required /> Sağlık beyanı alındı</label>
        <label><input type="checkbox" name="rules_accepted" required /> Kurallar okundu ve kabul edildi</label>
        <label><input type="checkbox" name="swim_cap_delivered" /> Sprint bonesi teslim edildi</label>
        <label><input type="checkbox" name="receipt_created" /> Makbuz oluşturuldu</label>
        <label><input type="checkbox" name="location_sent" /> Konum gönderildi</label>
      </div>
    </section>

    <section className="wizardCard messageCard">
      <p className="eyebrow">3 · MESAJ ÖN İZLEME</p>
      <div className="messageHeader"><h2>Kayıt Tamamlandı Mesajı</h2><button type="button" onClick={generateMessage}>Mesajı Yenile</button></div>
      <textarea value={message || fillTemplate(template, variables)} onChange={(event) => setMessage(event.target.value)} rows={22} />
      <div className="messageActions">
        <button type="button" onClick={copyMessage}>{copied ? "Kopyalandı ✓" : "Metni Kopyala"}</button>
        <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => setMessage(message || fillTemplate(template, variables))}>WhatsApp'ta Aç</a>
        <label className="sentCheck"><input type="checkbox" name="message_sent" /> Mesaj WhatsApp'ta açıldı/gönderildi</label>
      </div>
    </section>

    <div className="finalActions"><button type="submit">Kaydı Tamamla ve Öğrenciye Aktar</button></div>
  </form>;
}
