"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { applyManagerCorrection } from "./actions";

type Branch = { id: string; name: string };
type Group = { id: string; name: string; branch_id: string | null };
type Package = {
  id: string;
  name: string;
  lesson_count: number | null;
  price: number | null;
};
type Schedule = {
  id: string;
  group_id: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
};

type Props = {
  student: any;
  enrollment: any;
  attendancePlan: any;
  branches: Branch[];
  groups: Group[];
  packages: Package[];
  schedules: Schedule[];
};

const DAYS: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

function time(value?: string | null) {
  return String(value || "").slice(0, 5);
}

function money(value: unknown) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(Number(value || 0));
}

function calculatePlannedEndDate(
  startDate: string,
  lessonCount: number,
  weekdays: number[],
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    lessonCount < 1 ||
    !weekdays.length
  )
    return "";
  const allowedDays = new Set(weekdays.map((day) => (day === 7 ? 0 : day)));
  const cursor = new Date(`${startDate}T12:00:00`);
  let remaining = lessonCount;
  let safety = 0;

  while (remaining > 0 && safety < 730) {
    if (allowedDays.has(cursor.getDay())) remaining -= 1;
    if (remaining > 0) cursor.setDate(cursor.getDate() + 1);
    safety += 1;
  }

  return remaining === 0
    ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
    : "";
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="saveCorrection"
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="buttonSpinner" aria-hidden="true" />
          İşlem yapılıyor, lütfen bekleyin…
        </>
      ) : (
        "Düzeltmeyi Uygula + Geçmişe Kilitle"
      )}
    </button>
  );
}

export default function CorrectionForm({
  student,
  enrollment,
  attendancePlan,
  branches,
  groups,
  packages,
  schedules,
}: Props) {
  const initialGroupId = String(
    enrollment?.group_id || student?.preferred_group_id || "",
  );
  const initialBranchId = String(
    enrollment?.branch_id ||
      student?.branch_id ||
      groups.find((g) => g.id === initialGroupId)?.branch_id ||
      "",
  );
  const initialIsoDays = Array.isArray(attendancePlan?.selected_weekdays)
    ? attendancePlan.selected_weekdays.map(Number)
    : [];

  const [branchId, setBranchId] = useState(initialBranchId);
  const [groupId, setGroupId] = useState(initialGroupId);
  const [packageId, setPackageId] = useState(
    String(enrollment?.package_id || student?.preferred_package_id || ""),
  );
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>(() =>
    schedules
      .filter(
        (s) =>
          s.group_id === initialGroupId &&
          initialIsoDays.includes(Number(s.weekday)),
      )
      .map((s) => s.id),
  );
  const [totalLessons, setTotalLessons] = useState(
    String(enrollment?.total_lessons || ""),
  );
  const [startDate, setStartDate] = useState(
    String(enrollment?.start_date || ""),
  );

  const visibleGroups = useMemo(
    () => groups.filter((g) => !branchId || g.branch_id === branchId),
    [groups, branchId],
  );
  const visibleSchedules = useMemo(
    () => schedules.filter((s) => s.group_id === groupId),
    [schedules, groupId],
  );
  const selectedPackage = packages.find((p) => p.id === packageId) || null;
  const selectedWeekdays = useMemo(
    () =>
      Array.from(
        new Set(
          schedules
            .filter((schedule) => selectedScheduleIds.includes(schedule.id))
            .map((schedule) => Number(schedule.weekday))
            .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7),
        ),
      ),
    [schedules, selectedScheduleIds],
  );
  const plannedEndDate = useMemo(
    () =>
      calculatePlannedEndDate(
        startDate,
        Number(totalLessons || 0),
        selectedWeekdays,
      ),
    [startDate, totalLessons, selectedWeekdays],
  );

  function changePackage(nextId: string) {
    setPackageId(nextId);
    const next = packages.find((p) => p.id === nextId);
    if (next?.lesson_count) setTotalLessons(String(next.lesson_count));
  }

  return (
    <form action={applyManagerCorrection} className="correctionForm">
      <input type="hidden" name="student_id" value={student.id} />

      <section className="correctionSection">
        <div className="sectionHead">
          <div>
            <span>1 · KURSİYER</span>
            <h2>Kimlik ve iletişim bilgileri</h2>
          </div>
          <em>Mevcut kayıt korunur</em>
        </div>
        <div className="correctionGrid">
          <label>
            <span>Ad</span>
            <input
              name="first_name"
              defaultValue={student.first_name || ""}
              required
            />
          </label>
          <label>
            <span>Soyad</span>
            <input
              name="last_name"
              defaultValue={student.last_name || ""}
              required
            />
          </label>
          <label>
            <span>Doğum Tarihi</span>
            <input
              name="birth_date"
              type="date"
              defaultValue={student.birth_date || ""}
            />
          </label>
          <label>
            <span>Öğrenci Telefonu</span>
            <input name="phone" defaultValue={student.phone || ""} />
          </label>
          <label>
            <span>Öğrenci E-posta</span>
            <input
              name="email"
              type="email"
              defaultValue={student.email || ""}
            />
          </label>
          <label>
            <span>Veli Ad Soyad</span>
            <input
              name="guardian_name"
              defaultValue={student.guardian_name || ""}
            />
          </label>
          <label>
            <span>Veli Telefonu</span>
            <input
              name="guardian_phone"
              defaultValue={student.guardian_phone || ""}
            />
          </label>
          <label>
            <span>Veli E-posta</span>
            <input
              name="guardian_email"
              type="email"
              defaultValue={student.guardian_email || ""}
            />
          </label>
        </div>
      </section>

      <section className="correctionSection">
        <div className="sectionHead">
          <div>
            <span>2 · KAYIT / PAKET</span>
            <h2>Kesinleşmiş kayıt verilerini düzelt</h2>
          </div>
          <em>Ödeme geçmişi silinmez</em>
        </div>
        <div className="correctionGrid">
          <label>
            <span>Şube</span>
            <select
              name="branch_id"
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setGroupId("");
                setSelectedScheduleIds([]);
              }}
              required
            >
              <option value="">Şube seçin</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Grup</span>
            <select
              name="group_id"
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setSelectedScheduleIds([]);
              }}
              required
            >
              <option value="">Grup seçin</option>
              {visibleGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Paket</span>
            <select
              name="package_id"
              value={packageId}
              onChange={(e) => changePackage(e.target.value)}
              required
            >
              <option value="">Paket seçin</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.lesson_count || "—"} ders · {money(p.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Toplam Ders</span>
            <input
              name="total_lessons"
              type="number"
              min="1"
              value={totalLessons}
              onChange={(e) => setTotalLessons(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Başlangıç Tarihi</span>
            <input
              name="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Planlanan Bitiş Tarihi</span>
            <input
              type="date"
              value={plannedEndDate}
              readOnly
              aria-readonly="true"
              className="calculatedField"
            />
            <small className="fieldHelp">
              Paket, ders sayısı, başlangıç veya seans değişince otomatik
              hesaplanır.
            </small>
          </label>
          <label>
            <span>Ödeme Vade Tarihi</span>
            <input
              name="payment_due_date"
              type="date"
              defaultValue={
                enrollment?.payment_due_date || enrollment?.start_date || ""
              }
            />
          </label>
        </div>

        {selectedPackage ? (
          <div className="packageHint">
            <strong>{selectedPackage.name}</strong>
            <span>
              {selectedPackage.lesson_count || "—"} ders · Paket fiyatı{" "}
              {money(selectedPackage.price)}. Mevcut tahsilatlar silinmez; kalan
              ödeme yeni paket fiyatına göre tekrar görünür.
            </span>
          </div>
        ) : null}

        <div className="scheduleBlock">
          <div className="scheduleTitle">
            <strong>Ders gün / seansları</strong>
            <span>En az bir seans seçilmelidir.</span>
          </div>
          {visibleSchedules.length ? (
            <div className="scheduleChoices">
              {visibleSchedules.map((schedule) => {
                const checked = selectedScheduleIds.includes(schedule.id);
                return (
                  <label
                    key={schedule.id}
                    className={checked ? "selected" : ""}
                  >
                    <input
                      type="checkbox"
                      name="schedule_ids"
                      value={schedule.id}
                      checked={checked}
                      onChange={(e) =>
                        setSelectedScheduleIds((current) =>
                          e.target.checked
                            ? [...current, schedule.id]
                            : current.filter((id) => id !== schedule.id),
                        )
                      }
                    />
                    <strong>{DAYS[Number(schedule.weekday)] || "Ders"}</strong>
                    <span>
                      {time(schedule.start_time)}-{time(schedule.end_time)}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="emptySchedules">
              Seçili grupta aktif ders seansı bulunamadı.
            </div>
          )}
        </div>
      </section>

      <section className="correctionSection auditSection">
        <div className="sectionHead">
          <div>
            <span>3 · DENETİM KAYDI</span>
            <h2>Düzeltmeyi kilitle ve kaydet</h2>
          </div>
          <em>Owner / Admin</em>
        </div>
        <label className="reasonField">
          <span>Düzeltme gerekçesi</span>
          <textarea
            name="correction_reason"
            minLength={5}
            required
            placeholder="Örn: Kesin kayıt sırasında yanlış paket seçildi; gerçek paket 12 ders olmalıdır."
          />
        </label>
        <div className="lockNote">
          <b>🔒 Denetim kilidi:</b> Kaydettiğiniz düzeltmenin eski ve yeni
          değerleri öğrenci işlem geçmişine sabit kayıt olarak işlenir. Geçmiş
          kayıt silinmez; gerekiyorsa yeni bir düzeltme işlemi yapılır.
        </div>
        <SubmitButton />
      </section>
    </form>
  );
}
