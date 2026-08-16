import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { addStudentNote, updateStudentProfile } from "./actions";
import "./student-detail.css";

export const dynamic = "force-dynamic";

const fmt = (value?: string | null) => {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const fmtDate = (value?: string | null) => {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

/*
 * PostgreSQL tarafında yeni student_attendance_plans tablosunda
 * 1=Pazartesi ... 7=Pazar kullanıyoruz.
 *
 * Eski enrollment.lesson_weekdays alanında ise
 * 0=Pazar ... 6=Cumartesi kullanılmış olabilir.
 */
const isoDays: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

const oldDays: Record<number, string> = {
  0: "Pazar",
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
};

function money(value: unknown) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function StudentFile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  /*
   * =========================================================
   * ANA ÖĞRENCİ VERİLERİ
   * =========================================================
   */

  const [
    studentResult,
    enrollmentResult,
    membershipResult,
    attendancePlanResult,
    lessonBalanceResult,
    notesResult,
    oldTimelineResult,
    activityResult,
    messagesResult,
    contactLogsResult,
    lessonLedgerResult,
    paymentSummaryResult,
    paymentsResult,
    coachReportsResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*")
      .eq("id", id)
      .single(),

    supabase
      .from("student_enrollments")
      .select("*")
      .eq("student_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("student_group_memberships")
      .select("*")
      .eq("student_id", id)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("student_attendance_plans")
      .select("*")
      .eq("student_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("student_lesson_balance")
      .select("*")
      .eq("student_id", id)
      .maybeSingle(),

    supabase
      .from("student_notes")
      .select(
        "id,note_type,body,is_guardian_visible,created_at,author_id"
      )
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("student_timeline_events")
      .select("id,event_type,title,description,event_date")
      .eq("student_id", id)
      .order("event_date", { ascending: false })
      .limit(30),

    supabase
      .from("student_activity_logs")
      .select("*")
      .eq("student_id", id)
      .order("performed_at", { ascending: false })
      .limit(50),

    supabase
      .from("message_logs")
      .select(
        "id,template_key,channel,status,message_body,prepared_at,sent_at"
      )
      .eq("student_id", id)
      .order("prepared_at", { ascending: false })
      .limit(20),

    supabase
      .from("student_contact_logs")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(30),

    supabase
      .from("student_lesson_ledger")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("student_payment_summary")
      .select("*")
      .eq("student_id", id)
      .maybeSingle(),

    supabase
      .from("student_payments")
      .select("*")
      .eq("student_id", id)
      .order("received_at", { ascending: false })
      .limit(30),

    supabase
      .from("student_coach_reports")
      .select("*")
      .eq("student_id", id)
      .order("submitted_at", { ascending: false })
      .limit(30),
  ]);

  const student = studentResult.data;

  if (!student) {
    notFound();
  }

  const enrollment = enrollmentResult.data;
  const membership = membershipResult.data;
  const attendancePlan = attendancePlanResult.data;
  const lessonBalance = lessonBalanceResult.data;

  const notes = notesResult.data ?? [];
  const oldTimeline = oldTimelineResult.data ?? [];
  const activityLogs = activityResult.data ?? [];
  const messages = messagesResult.data ?? [];
  const contactLogs = contactLogsResult.data ?? [];
  const lessonLedger = lessonLedgerResult.data ?? [];
  const paymentSummary = paymentSummaryResult.data;
  const payments = paymentsResult.data ?? [];
  const coachReports = coachReportsResult.data ?? [];

  /*
   * =========================================================
   * GRUP
   * Öncelik:
   * membership.group_id
   * enrollment.group_id
   * attendancePlan.group_id
   * =========================================================
   */

  const groupId =
    membership?.group_id ??
    enrollment?.group_id ??
    attendancePlan?.group_id ??
    null;

  let groupInfo: any = null;

  if (groupId) {
    const { data } = await supabase
      .from("training_groups")
      .select("*")
      .eq("id", groupId)
      .maybeSingle();

    groupInfo = data;
  }

  /*
   * =========================================================
   * ŞUBE
   *
   * ARTIK .limit(1) YOK.
   *
   * Öncelik:
   * grubun branch_id
   * öğrencinin branch_id
   * kayıt branch_id
   * =========================================================
   */

  const branchId =
    groupInfo?.branch_id ??
    student.branch_id ??
    enrollment?.branch_id ??
    null;

  let branchInfo: any = null;

  if (branchId) {
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .maybeSingle();

    branchInfo = data;
  }

  /*
   * =========================================================
   * PAKET
   * =========================================================
   */

  let packageInfo: any = null;

  if (enrollment?.package_id) {
    const { data } = await supabase
      .from("course_packages")
      .select("*")
      .eq("id", enrollment.package_id)
      .maybeSingle();

    packageInfo = data;
  }

  /*
   * =========================================================
   * EĞİTMEN
   * =========================================================
   */

  const coachId =
    groupInfo?.primary_coach_id ??
    enrollment?.coach_id ??
    null;

  let coachName = "—";

  if (coachId) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", coachId)
      .maybeSingle();

    coachName = data?.full_name || "—";
  }

  /*
   * =========================================================
   * DERS HESAPLARI
   * =========================================================
   */

  const normalTotal = Number(
    enrollment?.total_lessons ??
      packageInfo?.lesson_count ??
      0
  );

  const usedLessons = Number(
    enrollment?.used_lessons ?? 0
  );

  const normalRemaining = Math.max(
    0,
    normalTotal - usedLessons
  );

  const compensationBalance = Math.max(
    0,
    Number(
      lessonBalance?.compensation_lesson_balance ??
        0
    )
  );

  const totalRights =
    normalRemaining + compensationBalance;

  /*
   * =========================================================
   * TARİHLER
   * =========================================================
   */

  const startDate =
    attendancePlan?.start_date ??
    enrollment?.start_date ??
    null;

  const normalEndDate =
    attendancePlan?.normal_planned_end_date ??
    enrollment?.planned_end_date ??
    null;

  const compensationEndDate =
    attendancePlan?.compensation_planned_end_date ??
    normalEndDate;

  /*
   * =========================================================
   * KATILIM GÜNLERİ
   * =========================================================
   */

  let attendanceDays = "—";

  if (
    Array.isArray(
      attendancePlan?.selected_weekdays
    ) &&
    attendancePlan.selected_weekdays.length >
      0
  ) {
    attendanceDays =
      attendancePlan.selected_weekdays
        .map(
          (day: number) =>
            isoDays[day] ??
            String(day)
        )
        .join(" • ");
  } else if (
    Array.isArray(enrollment?.lesson_weekdays) &&
    enrollment.lesson_weekdays.length > 0
  ) {
    attendanceDays =
      enrollment.lesson_weekdays
        .map(
          (day: number) =>
            oldDays[day] ??
            String(day)
        )
        .join(" • ");
  }

  const weeklyFrequency =
    attendancePlan?.weekly_frequency ??
    (Array.isArray(enrollment?.lesson_weekdays)
      ? enrollment.lesson_weekdays.length
      : null);

  /*
   * =========================================================
   * UYARI
   * =========================================================
   */

  const warningClass =
    totalRights <= 0
      ? "danger"
      : normalRemaining <= 2
      ? "warning"
      : "success";

  return (
    <main className="studentFilePage">
      {/* =====================================================
          ÜST KART
          ===================================================== */}

      <header className="studentHero">
        <div className="avatar">
          {student.first_name?.[0]}
          {student.last_name?.[0]}
        </div>

        <div className="heroText">
          <p>DİJİTAL KURSİYER DOSYASI</p>

          <h1>
            {student.first_name}{" "}
            {student.last_name}
          </h1>

          <div className="heroBadges">
            <span
              className={`status ${warningClass}`}
            >
              {student.status || "aktif"}
            </span>

            <span>
              {branchInfo?.name ||
                "Şube atanmadı"}
            </span>

            <span>
              {groupInfo?.name ||
                "Grup atanmadı"}
            </span>
          </div>
        </div>

        <Link
          className="backButton"
          href="/ogrenciler"
        >
          ← Öğrencilere Dön
        </Link>
      </header>

      {query.saved && (
        <div className="notice successNotice">
          İşlem başarıyla kaydedildi.
        </div>
      )}

      {query.error && (
        <div className="notice errorNotice">
          {query.error}
        </div>
      )}

      {/* =====================================================
          DERS ÖZETİ
          ===================================================== */}

      <section className="metricGrid">
        <article>
          <span>Normal Ders</span>
          <strong>{normalTotal}</strong>
        </article>

        <article>
          <span>Kullanılan</span>
          <strong>{usedLessons}</strong>
        </article>

        <article>
          <span>Normal Kalan</span>
          <strong>{normalRemaining}</strong>
        </article>

        <article>
          <span>Telafi</span>
          <strong>+{compensationBalance}</strong>
        </article>

        <article>
          <span>Toplam Hak</span>
          <strong>{totalRights}</strong>
        </article>

        <article>
          <span>Normal Bitiş</span>
          <strong>
            {fmtDate(normalEndDate)}
          </strong>
        </article>

        <article>
          <span>Telafili Bitiş</span>
          <strong>
            {fmtDate(compensationEndDate)}
          </strong>
        </article>
      </section>

      {/* =====================================================
          GENEL BİLGİLER + KURS ÖZETİ
          ===================================================== */}

      <div className="twoColumn">
        <section className="panel">
          <div className="panelHead">
            <div>
              <p>GENEL BİLGİLER</p>
              <h2>
                Öğrenci ve veli bilgileri
              </h2>
            </div>
          </div>

          <form
            action={updateStudentProfile}
            className="formGrid"
          >
            <input
              type="hidden"
              name="student_id"
              value={student.id}
            />

            <label>
              Telefon
              <input
                name="phone"
                defaultValue={
                  student.phone || ""
                }
              />
            </label>

            <label>
              E-posta
              <input
                name="email"
                type="email"
                defaultValue={
                  student.email || ""
                }
              />
            </label>

            <label>
              Veli Adı Soyadı
              <input
                name="guardian_name"
                defaultValue={
                  student.guardian_name ||
                  ""
                }
              />
            </label>

            <label>
              Veli Telefonu
              <input
                name="guardian_phone"
                defaultValue={
                  student.guardian_phone ||
                  ""
                }
              />
            </label>

            <label>
              Veli E-postası
              <input
                name="guardian_email"
                type="email"
                defaultValue={
                  student.guardian_email ||
                  ""
                }
              />
            </label>

            <label>
              Acil Durum Kişisi
              <input
                name="emergency_contact_name"
                defaultValue={
                  student.emergency_contact_name ||
                  ""
                }
              />
            </label>

            <label>
              Acil Durum Telefonu
              <input
                name="emergency_contact_phone"
                defaultValue={
                  student.emergency_contact_phone ||
                  ""
                }
              />
            </label>

            <label className="full">
              Genel Not
              <textarea
                name="general_note"
                rows={3}
                defaultValue={
                  student.general_note || ""
                }
              />
            </label>

            <button
              className="primaryButton"
              type="submit"
            >
              Bilgileri Kaydet
            </button>
          </form>
        </section>

        <aside className="panel courseCard">
          <div className="panelHead">
            <div>
              <p>KURS ÖZETİ</p>
              <h2>Aktif kayıt</h2>
            </div>
          </div>

          <div className="infoRows">
            <div>
              <span>Şube</span>
              <strong>
                {branchInfo?.name || "—"}
              </strong>
            </div>

            <div>
              <span>Grup</span>
              <strong>
                {groupInfo?.name || "—"}
              </strong>
            </div>

            <div>
              <span>Kurs Türü</span>
              <strong>
                {groupInfo?.course_type ||
                  "—"}
              </strong>
            </div>

            <div>
              <span>Paket</span>
              <strong>
                {packageInfo?.name ||
                  (normalTotal
                    ? `${normalTotal} Ders`
                    : "—")}
              </strong>
            </div>

            <div>
              <span>Eğitmen</span>
              <strong>{coachName}</strong>
            </div>

            <div>
              <span>Haftalık Katılım</span>
              <strong>
                {weeklyFrequency
                  ? `${weeklyFrequency} gün`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>Katılım Günleri</span>
              <strong>
                {attendanceDays}
              </strong>
            </div>

            <div>
              <span>Başlangıç</span>
              <strong>
                {fmtDate(startDate)}
              </strong>
            </div>

            <div>
              <span>Normal Bitiş</span>
              <strong>
                {fmtDate(normalEndDate)}
              </strong>
            </div>

            <div>
              <span>Telafili Bitiş</span>
              <strong>
                {fmtDate(
                  compensationEndDate
                )}
              </strong>
            </div>
          </div>
        </aside>
      </div>

      {/* =====================================================
          SAĞLIK
          ===================================================== */}

      <section className="panel">
        <div className="panelHead">
          <div>
            <p>SAĞLIK BİLGİLERİ</p>
            <h2>
              Güvenlik ve sağlık notları
            </h2>
          </div>
        </div>

        <form
          action={updateStudentProfile}
          className="formGrid healthGrid"
        >
          <input
            type="hidden"
            name="student_id"
            value={student.id}
          />

          <label>
            Alerji
            <textarea
              name="allergy_note"
              rows={3}
              defaultValue={
                student.allergy_note || ""
              }
            />
          </label>

          <label>
            Kronik Rahatsızlık
            <textarea
              name="chronic_condition_note"
              rows={3}
              defaultValue={
                student.chronic_condition_note ||
                ""
              }
            />
          </label>

          <label>
            Kullanılan İlaçlar
            <textarea
              name="medication_note"
              rows={3}
              defaultValue={
                student.medication_note ||
                ""
              }
            />
          </label>

          <label>
            Acil Müdahale Notu
            <textarea
              name="emergency_medical_note"
              rows={3}
              defaultValue={
                student.emergency_medical_note ||
                ""
              }
            />
          </label>

          <button
            className="primaryButton"
            type="submit"
          >
            Sağlık Bilgilerini Kaydet
          </button>
        </form>
      </section>

      {/* =====================================================
          ÖDEME
          ===================================================== */}

      <section className="panel">
        <div className="panelHead">
          <div>
            <p>FİNANS</p>
            <h2>Ödeme durumu</h2>
          </div>

          <strong>
            Toplam Tahsilat:{" "}
            {money(
              paymentSummary?.total_received
            )}
          </strong>
        </div>

        <div className="list">
          {payments.map((payment: any) => (
            <article key={payment.id}>
              <div>
                <strong>
                  {money(payment.amount)}
                </strong>

                <p>
                  {payment.payment_method ||
                    "Ödeme"}
                  {payment.description
                    ? ` • ${payment.description}`
                    : ""}
                </p>
              </div>

              <span>
                {payment.payment_status} •{" "}
                {fmt(payment.received_at)}
              </span>
            </article>
          ))}

          {!payments.length && (
            <p className="empty">
              Henüz ödeme kaydı yok.
            </p>
          )}
        </div>
      </section>

      {/* =====================================================
          TELAFİ / DERS HAREKETLERİ
          ===================================================== */}

      <section className="panel">
        <div className="panelHead">
          <div>
            <p>DERS HAREKETLERİ</p>
            <h2>
              Normal ders ve telafi geçmişi
            </h2>
          </div>
        </div>

        <div className="list">
          {lessonLedger.map(
            (item: any) => (
              <article key={item.id}>
                <div>
                  <strong>
                    {item.lesson_type ===
                    "compensation"
                      ? "TELAFİ"
                      : "NORMAL DERS"}{" "}
                    {item.direction ===
                    "credit"
                      ? "+"
                      : "-"}
                    {item.lesson_count}
                  </strong>

                  <p>
                    {item.reason ||
                      item.description ||
                      "Ders hareketi"}
                  </p>
                </div>

                <span>
                  {item.approval_status} •{" "}
                  {fmt(
                    item.approved_at ??
                      item.created_at
                  )}
                </span>
              </article>
            )
          )}

          {!lessonLedger.length && (
            <p className="empty">
              Henüz ders hareketi yok.
            </p>
          )}
        </div>
      </section>

      {/* =====================================================
          ANTRENÖR RAPORLARI
          ===================================================== */}

      <section className="panel">
        <div className="panelHead">
          <div>
            <p>ANTRENÖR RAPORLARI</p>
            <h2>
              Gelişim, seviye ve grup uyumu
            </h2>
          </div>
        </div>

        <div className="list">
          {coachReports.map(
            (report: any) => (
              <article key={report.id}>
                <div>
                  <strong>
                    {report.title}
                  </strong>

                  <p>
                    {report.description}
                  </p>
                </div>

                <span>
                  {report.severity} •{" "}
                  {report.management_status} •{" "}
                  {fmt(report.submitted_at)}
                </span>
              </article>
            )
          )}

          {!coachReports.length && (
            <p className="empty">
              Henüz antrenör raporu yok.
            </p>
          )}
        </div>
      </section>

      {/* =====================================================
          NOTLAR + İŞLEM GEÇMİŞİ
          ===================================================== */}

      <div className="twoColumn">
        <section className="panel">
          <div className="panelHead">
            <div>
              <p>NOTLAR</p>
              <h2>
                Antrenör ve yönetim notları
              </h2>
            </div>
          </div>

          <form
            action={addStudentNote}
            className="noteForm"
          >
            <input
              type="hidden"
              name="student_id"
              value={student.id}
            />

            <select name="note_type">
              <option value="general">
                Genel
              </option>

              <option value="coach">
                Antrenör
              </option>

              <option value="health">
                Sağlık
              </option>

              <option value="finance">
                Finans
              </option>

              <option value="crm">
                CRM
              </option>
            </select>

            <textarea
              name="body"
              rows={4}
              placeholder="Yeni not yazın..."
              required
            />

            <label className="checkbox">
              <input
                type="checkbox"
                name="is_guardian_visible"
              />{" "}
              Veli panelinde göster
            </label>

            <button
              className="primaryButton"
              type="submit"
            >
              Notu Ekle
            </button>
          </form>

          <div className="list">
            {notes.map((note: any) => (
              <article key={note.id}>
                <div>
                  <strong>
                    {String(
                      note.note_type
                    ).toUpperCase()}
                  </strong>

                  <p>{note.body}</p>
                </div>

                <span>
                  {fmt(note.created_at)}
                </span>
              </article>
            ))}

            {!notes.length && (
              <p className="empty">
                Henüz not yok.
              </p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panelHead">
            <div>
              <p>İŞLEM GEÇMİŞİ</p>
              <h2>
                Öğrenci hareketleri
              </h2>
            </div>
          </div>

          <div className="timeline">
            {activityLogs.map(
              (event: any) => (
                <article key={event.id}>
                  <i />

                  <div>
                    <strong>
                      {event.title}
                    </strong>

                    <p>
                      {event.description ||
                        event.activity_type}
                    </p>

                    <span>
                      {fmt(
                        event.performed_at ??
                          event.created_at
                      )}
                    </span>
                  </div>
                </article>
              )
            )}

            {!activityLogs.length &&
              oldTimeline.map(
                (event: any) => (
                  <article key={event.id}>
                    <i />

                    <div>
                      <strong>
                        {event.title}
                      </strong>

                      <p>
                        {event.description ||
                          event.event_type}
                      </p>

                      <span>
                        {fmt(
                          event.event_date
                        )}
                      </span>
                    </div>
                  </article>
                )
              )}

            {!activityLogs.length &&
              !oldTimeline.length && (
                <p className="empty">
                  Henüz işlem geçmişi yok.
                </p>
              )}
          </div>
        </section>
      </div>

      {/* =====================================================
          MESAJLAR
          ===================================================== */}

      <div className="twoColumn">
        <section className="panel">
          <div className="panelHead">
            <div>
              <p>MESAJ GEÇMİŞİ</p>
              <h2>Veli iletişimi</h2>
            </div>
          </div>

          <div className="list">
            {contactLogs.map(
              (message: any) => (
                <article key={message.id}>
                  <div>
                    <strong>
                      {message.contact_type ||
                        "Bilgilendirme"}
                    </strong>

                    <p>
                      {message.message_text ||
                        "Mesaj kaydı"}
                    </p>
                  </div>

                  <span>
                    {message.status} •{" "}
                    {fmt(
                      message.sent_at ??
                        message.prepared_at ??
                        message.created_at
                    )}
                  </span>
                </article>
              )
            )}

            {!contactLogs.length &&
              messages.map(
                (message: any) => (
                  <article key={message.id}>
                    <div>
                      <strong>
                        {message.template_key ||
                          "Mesaj"}
                      </strong>

                      <p>
                        {message.message_body?.slice(
                          0,
                          180
                        )}
                        {message.message_body
                          ?.length > 180
                          ? "…"
                          : ""}
                      </p>
                    </div>

                    <span>
                      {message.status} •{" "}
                      {fmt(
                        message.sent_at ??
                          message.prepared_at
                      )}
                    </span>
                  </article>
                )
              )}

            {!contactLogs.length &&
              !messages.length && (
                <p className="empty">
                  Henüz mesaj kaydı yok.
                </p>
              )}
          </div>
        </section>

        <section className="panel">
          <div className="panelHead">
            <div>
              <p>KAYIT DURUMU</p>
              <h2>
                Ders ve yenileme özeti
              </h2>
            </div>
          </div>

          <div className="infoRows">
            <div>
              <span>Normal Paket</span>
              <strong>
                {normalTotal} ders
              </strong>
            </div>

            <div>
              <span>Kullanılan</span>
              <strong>
                {usedLessons} ders
              </strong>
            </div>

            <div>
              <span>Normal Kalan</span>
              <strong>
                {normalRemaining} ders
              </strong>
            </div>

            <div>
              <span>Telafi Hakkı</span>
              <strong>
                {compensationBalance} ders
              </strong>
            </div>

            <div>
              <span>Toplam Kullanılabilir</span>
              <strong>
                {totalRights} ders
              </strong>
            </div>

            <div>
              <span>Son Ödeme</span>
              <strong>
                {fmt(
                  paymentSummary?.last_payment_at
                )}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
