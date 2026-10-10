"use server";

import { verifyAttendanceRows } from "@/lib/attendance/integrity";
import { attendanceRoster } from "@/lib/attendance/roster";
import { createClient as createAuditClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/profile";
import { createNotification } from "@/lib/notifications/create-notification";

type AttendanceStatus =
  | "present"
  | "absent"
  | "excused"
  | "compensation";

type AttendanceRecordInput = {
  studentId: string;
  enrollmentId: string | null;
  status: AttendanceStatus;
  coachNote: string | null;
};

type SaveAttendanceInput = {
  branchId: string | null;
  groupId: string;
  scheduleId: string;
  coachId: string | null;
  lessonDate: string;
  records: AttendanceRecordInput[];
};

type DailyAttendanceInput = {
  groupId: string;
  scheduleId: string;
  lessonDate: string;
};

type ClearAttendanceInput = {
  studentId: string;
  groupId: string;
  scheduleId: string;
  lessonDate: string;
};

type MonthlyAttendanceInput = {
  groupId: string;
  month: string;
};

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
] as const;

const ALLOWED_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "excused",
  "compensation",
];

/*
 * NORMAL PAKETTEN DÜŞEN STATÜLER
 *
 * Sprint Yüzme Okulu kuralı:
 * - Geldi      -> ders hakkından düşer
 * - Gelmedi    -> ders hakkından düşer
 * - İzinli     -> yalnız bilgilendirme statüsüdür,
 *                 ders hakkından düşer
 * - Telafi     -> normal paketten düşmez
 */
const PACKAGE_CONSUMING_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "excused",
];

async function getAuthorizedProfile() {
  return requireProfile([...ALLOWED_ROLES]);
}

// Only called after the user's organization, role, schedule and students have
// been validated. The service client is used solely for the protected audit log.
async function auditAttendance(profile: Awaited<ReturnType<typeof getAuthorizedProfile>>, action:string, scheduleId:string, metadata:Record<string,unknown>) {
  try {
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key)return false;
    const audit=createAuditClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await audit.from("audit_logs").insert({organization_id:profile.organization_id,actor_profile_id:profile.id,module_key:"attendance",action_key:action,action_label:action==="save"?"Yoklama kaydı doğrulandı":"Yoklama temizleme isteği",entity_type:"lesson_schedule",entity_id:scheduleId,request_path:"/yoklama",success:true,metadata});
    return !error;
  } catch {return false;}
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    )
  );
}

/*
 * ---------------------------------------------------------
 * AKTİF KAYITLARIN used_lessons DEĞERİNİ GERÇEK YOKLAMADAN
 * YENİDEN HESAPLA
 * ---------------------------------------------------------
 *
 * Neden +1 / -1 yapmıyoruz?
 *
 * Aynı yoklama tekrar kaydedilebilir veya geçmiş bir yoklama
 * düzeltilebilir. Körlemesine +1 yapmak mükerrer ders düşümüne
 * neden olur.
 *
 * Bunun yerine ilgili enrollment_id için attendance_records
 * tablosundaki gerçek normal ders kayıtlarını yeniden sayıyoruz.
 *
 * Telafi kayıtları (status = compensation) bu sayıya girmez.
 */
async function syncEnrollmentUsedLessons(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  enrollmentIds: string[];
}) {
  const { supabase, organizationId, enrollmentIds } = params;

  // Yoklama normal paket sayacını hesaplamaz. Merkezi planlı ders motoru
  // tüm aktif kayıtları gerçek seanslara göre idempotent olarak senkronize eder.
  const { error } = await supabase.rpc("sync_scheduled_used_lessons", {
    p_organization_id: organizationId,
  });

  if (error) {
    return {
      ok: false as const,
      message: `Merkezi ders bakiyesi güncellenemedi: ${error.message}`,
      updatedEnrollmentIds: [] as string[],
      studentIds: [] as string[],
    };
  }

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("student_enrollments")
    .select("id, student_id")
    .eq("organization_id", organizationId)
    .in("id", enrollmentIds);

  if (enrollmentError) {
    return {
      ok: false as const,
      message: `Kayıtlar yenilenemedi: ${enrollmentError.message}`,
      updatedEnrollmentIds: [] as string[],
      studentIds: [] as string[],
    };
  }

  return {
    ok: true as const,
    updatedEnrollmentIds: (enrollments || []).map((e) => e.id),
    studentIds: uniqueStrings((enrollments || []).map((e) => e.student_id)),
  };
}

/*
 * ---------------------------------------------------------
 * YOKLAMA KAYDET
 * ---------------------------------------------------------
 */
export async function saveAttendance(input: SaveAttendanceInput) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        count: 0,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!input.groupId || !input.scheduleId || !input.lessonDate) {
      return {
        ok: false,
        count: 0,
        message:
          "Grup, ders seansı ve tarih bilgisi zorunludur.",
      };
    }

    if (!input.records?.length) {
      return {
        ok: false,
        count: 0,
        message: "Kaydedilecek öğrenci bulunamadı.",
      };
    }

    const invalidRecord = input.records.find(
      (record) =>
        !record.studentId ||
        !ALLOWED_STATUSES.includes(record.status)
    );

    if (invalidRecord) {
      return {
        ok: false,
        count: 0,
        message: "Geçersiz yoklama kaydı tespit edildi.",
      };
    }

    const { data: group, error: groupError } = await supabase
      .from("training_groups")
      .select("id, branch_id, primary_coach_id")
      .eq("id", input.groupId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (groupError || !group) {
      return {
        ok: false,
        count: 0,
        message:
          "Grup bulunamadı veya bu kuruma ait değil.",
      };
    }

    const {
      data: schedule,
      error: scheduleError,
    } = await supabase
      .from("lesson_schedules")
      .select("id, branch_id, group_id, coach_id, weekday, is_active")
      .eq("id", input.scheduleId)
      .eq("group_id", input.groupId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return {
        ok: false,
        count: 0,
        message: "Seçilen ders programı bulunamadı.",
      };
    }

    const requestedDay = new Date(`${input.lessonDate}T12:00:00Z`).getUTCDay();
    if (schedule.is_active === false || (Number(schedule.weekday) === 7 ? 0 : Number(schedule.weekday)) !== requestedDay) {
      return {ok:false,count:0,message:"Seçilen tarih bu seansın ders günüyle eşleşmiyor."};
    }

    // Eğitmen yalnızca kendisine atanmış grup/seanslarda yoklama alabilir.
    // owner/admin gibi yönetim rolleri kurum genelinde işlem yapmaya devam eder.
    if (profile.role === "coach" && !profile.is_super_user) {
      const { data: coachStaff, error: coachStaffError } = await supabase
        .from("staff")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("auth_user_id", profile.id)
        .eq("is_active", true)
        .maybeSingle();

      if (coachStaffError) {
        return {
          ok: false,
          count: 0,
          message: "Eğitmen personel kaydı doğrulanamadı.",
        };
      }

      // Operasyon planı seans/eğitmen atamalarında profile.id kullanıyor.
      // Personel/puantaj tarafında staff.id kullanılan eski/ek kayıtlarla da
      // uyumlu kalmak için her iki kimliği yetkili eğitmen kimliği kabul ediyoruz.
      const coachIds = uniqueStrings([profile.id, coachStaff?.id]);

      let staffAssignment: { id: string } | null = null;
      if (coachIds.length) {
        const assignmentResult = await supabase
          .from("lesson_staff_assignments")
          .select("id")
          .eq("organization_id", organizationId)
          .in("coach_id", coachIds)
          .eq("is_active", true)
          .or(`schedule_id.eq.${input.scheduleId},and(schedule_id.is.null,group_id.eq.${input.groupId})`)
          .limit(1)
          .maybeSingle();

        staffAssignment = assignmentResult.data;
      }

      const recordStudentIds = uniqueStrings(input.records.map((record) => record.studentId));
      let assignedStudentIds = new Set<string>();
      if (coachIds.length && recordStudentIds.length) {
        const { data: studentAssignments } = await supabase
          .from("lesson_student_assignments")
          .select("student_id")
          .eq("organization_id", organizationId)
          .eq("schedule_id", input.scheduleId)
          .in("coach_id", coachIds)
          .eq("is_active", true)
          .in("student_id", recordStudentIds);
        assignedStudentIds = new Set((studentAssignments || []).map((item: any) => String(item.student_id)));
      }

      const assignedDirectly =
        (schedule.coach_id ? coachIds.includes(schedule.coach_id) : false) ||
        (group.primary_coach_id ? coachIds.includes(group.primary_coach_id) : false) ||
        Boolean(staffAssignment?.id);

      if (!assignedDirectly && assignedStudentIds.size !== recordStudentIds.length) {
        return {
          ok: false,
          count: 0,
          message: "Bu seans veya seçili öğrenciler size atanmış değil. Yalnızca kendi öğrenci, grup ve seanslarınızın yoklamasını alabilirsiniz.",
        };
      }
    }

    const studentIds = uniqueStrings(
      input.records.map((record) => record.studentId)
    );

    const {
      data: validStudents,
      error: studentError,
    } = await supabase
      .from("students")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", studentIds);

    if (studentError) {
      return {
        ok: false,
        count: 0,
        message: `Öğrenciler doğrulanamadı: ${studentError.message}`,
      };
    }

    const validStudentIds = new Set(
      (validStudents || []).map(
        (student: { id: string }) => student.id
      )
    );

    const unauthorizedStudent = input.records.some(
      (record) => !validStudentIds.has(record.studentId)
    );

    if (unauthorizedStudent) {
      return {
        ok: false,
        count: 0,
        message:
          "Yoklama listesinde kuruma ait olmayan öğrenci bulundu.",
      };
    }

    /*
     * Enrollment ID gönderilen kayıtları ayrıca doğruluyoruz.
     * Böylece başka öğrenciye veya başka kuruma ait kayıt yanlışlıkla
     * yoklamaya bağlanamaz.
     */
    const enrollmentIds = uniqueStrings(
      input.records.map((record) => record.enrollmentId)
    );

    if (enrollmentIds.length) {
      const {
        data: validEnrollments,
        error: enrollmentValidationError,
      } = await supabase
        .from("student_enrollments")
        .select("id, student_id")
        .eq("organization_id", organizationId)
        .in("id", enrollmentIds);

      if (enrollmentValidationError) {
        return {
          ok: false,
          count: 0,
          message: `Öğrenci kayıtları doğrulanamadı: ${enrollmentValidationError.message}`,
        };
      }

      const enrollmentStudentMap = new Map<string, string>();

      for (const enrollment of validEnrollments || []) {
        enrollmentStudentMap.set(
          enrollment.id,
          enrollment.student_id
        );
      }

      const invalidEnrollment = input.records.find((record) => {
        if (!record.enrollmentId) return false;

        return (
          enrollmentStudentMap.get(record.enrollmentId) !==
          record.studentId
        );
      });

      if (invalidEnrollment) {
        return {
          ok: false,
          count: 0,
          message:
            "Yoklama listesinde öğrenciyle eşleşmeyen kayıt/paket bilgisi bulundu.",
        };
      }
    }

    // Rebuild the eligible roster on the server: stale screens cannot save a
    // normal lesson on a day that was not selected in the registration.
    const [rosterStudents, rosterEnrollments, rosterMemberships, rosterCompensations] = await Promise.all([
      supabase.from("students").select("id,status").eq("organization_id", organizationId).eq("is_deleted", false).in("id", studentIds),
      supabase.from("student_enrollments").select("id,student_id,group_id,status,lesson_weekdays,start_date,created_at,updated_at,start_confirmation_required,actual_started_at").eq("organization_id", organizationId).eq("group_id", input.groupId).eq("status", "active").in("student_id", studentIds),
      supabase.from("student_group_memberships").select("student_id,group_id,is_active").eq("organization_id", organizationId).eq("group_id", input.groupId).eq("is_active", true).in("student_id", studentIds),
      supabase.from("student_compensation_lessons").select("student_id,target_group_id,target_schedule_id,lesson_date,status").eq("organization_id", organizationId).eq("lesson_date", input.lessonDate).eq("status", "planned").in("student_id", studentIds),
    ]);
    if (rosterStudents.error || rosterEnrollments.error || rosterMemberships.error || rosterCompensations.error) {
      return {ok:false,count:0,message:"Öğrencilerin kayıt günleri doğrulanamadı. Yoklama kaydedilmedi."};
    }
    const lessonDay = new Date(`${input.lessonDate}T12:00:00Z`).getUTCDay();
    const roster = attendanceRoster({students:rosterStudents.data||[],enrollments:rosterEnrollments.data||[],memberships:rosterMemberships.data||[],compensationLessons:rosterCompensations.data||[]}, input.groupId, input.scheduleId, input.lessonDate, lessonDay===0?7:lessonDay);
    const eligibleIds = new Set(roster.students.map(student=>student.id));
    if(input.records.some(record=>!eligibleIds.has(record.studentId))) {
      return {ok:false,count:0,message:"Listede bu gün için kaydı veya telafisi olmayan öğrenci var. Yoklamayı yenileyip tekrar deneyin."};
    }

    const { data: previousAttendance, error: previousError } = await supabase
      .from("attendance_records")
      .select("student_id,status,coach_note,recorded_by")
      .eq("organization_id", organizationId)
      .eq("group_id", input.groupId)
      .eq("schedule_id", input.scheduleId)
      .eq("lesson_date", input.lessonDate)
      .in("student_id", studentIds);

    if(previousError)return {ok:false,count:0,message:"Mevcut yoklama okunamadı. Önceki kayıtları korumak için işlem durduruldu."};
    const previousRows = new Map((previousAttendance||[]).map((item:any)=>[String(item.student_id),item]));
    const previousStatus = new Map(
      (previousAttendance || []).map((item: any) => [String(item.student_id), String(item.status || "")])
    );

    const now = new Date().toISOString();

    const rows = input.records.map((record) => ({
      organization_id: organizationId,

      branch_id:
        schedule.branch_id ??
        group.branch_id ??
        input.branchId ??
        null,

      student_id: record.studentId,

      enrollment_id: record.enrollmentId ?? null,

      group_id: input.groupId,

      schedule_id: input.scheduleId,

      coach_id:
        schedule.coach_id ??
        input.coachId ??
        group.primary_coach_id ??
        null,

      lesson_date: input.lessonDate,

      status: record.status,

      coach_note: record.coachNote===null ? previousRows.get(record.studentId)?.coach_note||null : record.coachNote.trim()||null,

      recorded_by: previousRows.get(record.studentId)?.recorded_by||profile.id,
      updated_by: profile.id,
      edited_at: now,
      updated_at: now,
    }));

    const { error } = await supabase
      .from("attendance_records")
      .upsert(rows, {
        onConflict:
          "student_id,lesson_date,group_id,schedule_id",
      });

    if (error) {
      return {
        ok: false,
        count: 0,
        message: `Yoklama kaydedilemedi: ${error.message}`,
      };
    }

    const {data: written, error: verifyError} = await supabase.from("attendance_records")
      .select("student_id,status").eq("organization_id",organizationId)
      .eq("group_id",input.groupId).eq("schedule_id",input.scheduleId)
      .eq("lesson_date",input.lessonDate).in("student_id",studentIds);
    if(verifyError||!verifyAttendanceRows(rows,written)) {
      return {ok:false,count:0,message:"Yoklama yazıldı ancak kayıt sonucu doğrulanamadı. Yenileyip kontrol edin; taslağınızı silmeyin."};
    }

    const auditOk=await auditAttendance(profile,"save",input.scheduleId,{lessonDate:input.lessonDate,groupId:input.groupId,before:previousAttendance||[],after:rows,count:rows.length});

    /*
     * -------------------------------------------------------
     * DERS HAKKI SENKRONİZASYONU
     * -------------------------------------------------------
     *
     * Yoklama kaydı başarılı olduktan sonra ilgili paketlerin
     * used_lessons değerini merkezi planlı ders motorundan yeniden senkronize ediyoruz.
     *
     * Geldi / Gelmedi / İzinli -> paket hakkından düşer
     * Telafi                    -> normal paketten düşmez
     */
    const syncResult = await syncEnrollmentUsedLessons({
      supabase,
      organizationId,
      enrollmentIds,
    });

    if (!syncResult.ok) {
      /*
       * Yoklama kaydedildi ancak ders sayacı güncellenemediyse
       * kullanıcıya bunu açıkça bildiriyoruz.
       */
      for (const route of ["/yoklama", "/operasyon-plani", "/yoklama/aylik", "/yoklama/gecmis", "/raporlar", "/ogrenciler", "/", "/veli-paneli", "/veli-devam"]) revalidatePath(route);
      for (const studentId of studentIds) revalidatePath(`/ogrenciler/${studentId}`);

      return {
        ok: false,
        count: rows.length,
        message:
          `Yoklama kaydedildi ancak ders hakkı güncellenemedi. ${syncResult.message}`,
      };
    }

    /*
     * -------------------------------------------------------
     * BAĞLI MODÜLLERİ YENİLE
     * -------------------------------------------------------
     */
    revalidatePath("/yoklama");
    revalidatePath("/operasyon-plani");
    revalidatePath("/yoklama/aylik");
    revalidatePath("/yoklama/gecmis");
    revalidatePath("/raporlar");
    revalidatePath("/ogrenciler");
    revalidatePath("/odemeler");
    revalidatePath("/");
    revalidatePath("/veli-paneli");
    revalidatePath("/veli-devam");

    // Yeni bir "gelmedi" kaydı oluştuğunda yönetim + atanmış eğitmenlere,
    // portal hesabı olan veli/kursiyer tarafına da bildirim üret.
    const newlyAbsent = input.records.filter(
      (record) => record.status === "absent" && previousStatus.get(record.studentId) !== "absent"
    );

    for (const record of newlyAbsent) {
      const { data: student } = await supabase
        .from("students")
        .select("id,first_name,last_name")
        .eq("organization_id", organizationId)
        .eq("id", record.studentId)
        .maybeSingle();

      const studentName = `${student?.first_name || ""} ${student?.last_name || ""}`.trim() || "Kursiyer";
      const body = `${studentName}, ${input.lessonDate} tarihli derse katılmadı.`;

      try {
        await createNotification({
          organizationId,
          title: "Devamsızlık kaydedildi",
          body,
          category: "attendance",
          eventKey: `attendance_absent:${record.studentId}:${input.lessonDate}:${input.scheduleId}`,
          notificationType: "attendance_absent",
          severity: "warning",
          priority: "high",
          studentId: record.studentId,
          sourceType: "schedule",
          sourceId: input.scheduleId,
          targetPath: `/ogrenciler/${record.studentId}?tab=yoklama`,
          metadata: {
            branchId: schedule.branch_id ?? group.branch_id ?? input.branchId ?? null,
            groupId: input.groupId,
            scheduleId: input.scheduleId,
            coachProfileId: profile.role === "coach" ? profile.id : null,
          },
          createdBy: profile.id,
          push: true,
        });
      } catch (notificationError) {
        console.error("Attendance staff notification:", notificationError);
      }

      try {
        const { data: guardianLinks } = await supabase
          .from("guardian_students")
          .select("guardian_id")
          .eq("student_id", record.studentId)
          .eq("portal_access", true);

        const guardianIds = uniqueStrings((guardianLinks || []).map((item: any) => item.guardian_id));
        if (guardianIds.length) {
          const { data: guardians } = await supabase
            .from("guardians")
            .select("auth_user_id")
            .eq("organization_id", organizationId)
            .in("id", guardianIds)
            .eq("is_active", true)
            .eq("login_enabled", true);

          const guardianProfileIds = uniqueStrings((guardians || []).map((item: any) => item.auth_user_id));
          if (guardianProfileIds.length) {
            await createNotification({
              organizationId,
              title: "Ders katılım bilgisi",
              body: `${studentName}, ${input.lessonDate} tarihli derse katılmadı. Detayları Dersler & Yoklama ekranından görebilirsiniz.`,
              category: "attendance",
              eventKey: `guardian_attendance_absent:${record.studentId}:${input.lessonDate}:${input.scheduleId}`,
              notificationType: "guardian_attendance_absent",
              severity: "warning",
              priority: "high",
              studentId: record.studentId,
              sourceType: "schedule",
              sourceId: input.scheduleId,
              targetPath: `/veli-devam?child=${record.studentId}`,
              recipientProfileIds: guardianProfileIds,
              metadata: {
                branchId: schedule.branch_id ?? group.branch_id ?? input.branchId ?? null,
                groupId: input.groupId,
                scheduleId: input.scheduleId,
              },
              createdBy: profile.id,
              push: true,
            });
          }
        }
      } catch (guardianNotificationError) {
        console.error("Attendance guardian notification:", guardianNotificationError);
      }
    }

    for (const studentId of syncResult.studentIds) {
      revalidatePath(`/ogrenciler/${studentId}`);
    }

    return {
      ok: true,
      count: rows.length,
      message:
        `Yoklama başarıyla kaydedildi ve ders hakları güncellendi.${auditOk?"":" İşlem günlüğü yazılamadı; yönetici kontrolü gerekiyor."}`,
    };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      message:
        error instanceof Error
          ? `Yoklama kaydedilemedi: ${error.message}`
          : "Yoklama kaydedilirken beklenmeyen hata oluştu.",
    };
  }
}

export async function clearAttendance(input: ClearAttendanceInput) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return { ok: false, message: "Organizasyon bilgisi bulunamadı." };
    }

    if (!input.studentId || !input.groupId || !input.scheduleId || !input.lessonDate) {
      return { ok: false, message: "Öğrenci, grup, seans ve tarih bilgisi zorunludur." };
    }

    const { data: group, error: groupError } = await supabase
      .from("training_groups")
      .select("id,primary_coach_id")
      .eq("organization_id", organizationId)
      .eq("id", input.groupId)
      .maybeSingle();

    const { data: schedule, error: scheduleError } = await supabase
      .from("lesson_schedules")
      .select("id,coach_id")
      .eq("organization_id", organizationId)
      .eq("id", input.scheduleId)
      .eq("group_id", input.groupId)
      .maybeSingle();

    if (groupError || scheduleError || !group || !schedule) {
      return { ok: false, message: "Seçilen grup veya ders seansı bulunamadı." };
    }

    if (profile.role === "coach" && !profile.is_super_user) {
      const { data: coachStaff } = await supabase
        .from("staff")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("auth_user_id", profile.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!coachStaff?.id) {
        return { ok: false, message: "Eğitmen personel kaydınız bulunamadı." };
      }

      const { data: staffAssignment } = await supabase
        .from("lesson_staff_assignments")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("coach_id", coachStaff.id)
        .eq("is_active", true)
        .or(`schedule_id.eq.${input.scheduleId},and(schedule_id.is.null,group_id.eq.${input.groupId})`)
        .limit(1)
        .maybeSingle();

      const assignedDirectly =
        schedule.coach_id === coachStaff.id ||
        group.primary_coach_id === coachStaff.id ||
        Boolean(staffAssignment?.id);

      if (!assignedDirectly) {
        return { ok: false, message: "Bu seans size atanmış değil." };
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from("attendance_records")
      .select("id,enrollment_id,student_id,status,coach_note,recorded_by,updated_at")
      .eq("organization_id", organizationId)
      .eq("student_id", input.studentId)
      .eq("group_id", input.groupId)
      .eq("schedule_id", input.scheduleId)
      .eq("lesson_date", input.lessonDate)
      .maybeSingle();

    if (existingError) {
      return { ok: false, message: `Yoklama kaydı okunamadı: ${existingError.message}` };
    }

    if (!existing?.id) {
      return { ok: true, message: "Yoklama seçimi zaten temiz." };
    }

    const deletionAuditOk=await auditAttendance(profile,"clear_requested",input.scheduleId,{lessonDate:input.lessonDate,groupId:input.groupId,before:existing});
    if(!deletionAuditOk)return {ok:false,message:"İşlem günlüğü oluşturulamadığı için yoklama silinmedi."};

    const { error: deleteError } = await supabase
      .from("attendance_records")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", existing.id);

    if (deleteError) {
      return { ok: false, message: `Yoklama seçimi temizlenemedi: ${deleteError.message}` };
    }

    if (existing.enrollment_id) {
      const syncResult = await syncEnrollmentUsedLessons({
        supabase,
        organizationId,
        enrollmentIds: [existing.enrollment_id],
      });

      if (!syncResult.ok) {
        return {
          ok: false,
          message: `Yoklama seçimi temizlendi ancak ders hakkı güncellenemedi. ${syncResult.message}`,
        };
      }
    } else {
      const { error: syncError } = await supabase.rpc("sync_scheduled_used_lessons", {
        p_organization_id: organizationId,
      });
      if (syncError) {
        return {
          ok: false,
          message: `Yoklama seçimi temizlendi ancak ders hakkı güncellenemedi: ${syncError.message}`,
        };
      }
    }

    revalidatePath("/yoklama");
    revalidatePath("/operasyon-plani");
    revalidatePath("/yoklama/aylik");
    revalidatePath("/yoklama/gecmis");
    revalidatePath("/raporlar");
    revalidatePath("/ogrenciler");
    revalidatePath("/");
    revalidatePath("/veli-paneli");
    revalidatePath("/veli-devam");
    revalidatePath(`/ogrenciler/${input.studentId}`);

    return { ok: true, message: "Yoklama seçimi temizlendi ve ders hakkı yeniden hesaplandı." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Yoklama seçimi temizlenemedi: ${error.message}`
          : "Yoklama seçimi temizlenirken beklenmeyen hata oluştu.",
    };
  }
}

/*
 * ---------------------------------------------------------
 * GÜNLÜK YOKLAMA YÜKLE
 * ---------------------------------------------------------
 */
export async function getAttendanceForDate(
  input: DailyAttendanceInput
) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        records: [],
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!input.groupId || !input.scheduleId || !input.lessonDate) {
      return {
        ok: false,
        records: [],
        message: "Grup, seans ve tarih bilgisi eksik.",
      };
    }

    const { data, error } = await supabase
      .from("attendance_records")
      .select(
        "id, student_id, enrollment_id, group_id, schedule_id, coach_id, lesson_date, status, coach_note, recorded_by, updated_by, edited_at, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("group_id", input.groupId)
      .eq("schedule_id", input.scheduleId)
      .eq("lesson_date", input.lessonDate);

    if (error) {
      return {
        ok: false,
        records: [],
        message: `Yoklama yüklenemedi: ${error.message}`,
      };
    }

    return {
      ok: true,
      records: data || [],
      message: data?.length
        ? "Kayıtlı yoklama yüklendi."
        : "Bu tarih için henüz yoklama alınmamış.",
    };
  } catch (error) {
    return {
      ok: false,
      records: [],
      message:
        error instanceof Error
          ? error.message
          : "Günlük yoklama yüklenemedi.",
    };
  }
}

/*
 * ---------------------------------------------------------
 * AYLIK YOKLAMA
 * ---------------------------------------------------------
 */
export async function getMonthlyAttendance(
  input: MonthlyAttendanceInput
) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        records: [],
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!input.groupId || !/^\d{4}-\d{2}$/.test(input.month)) {
      return {
        ok: false,
        records: [],
        message: "Grup veya ay bilgisi geçersiz.",
      };
    }

    const [yearText, monthText] = input.month.split("-");

    const year = Number(yearText);
    const monthNumber = Number(monthText);

    const startDate = `${yearText}-${monthText}-01`;

    const nextMonth =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNumber + 1).padStart(
            2,
            "0"
          )}-01`;

    const { data, error } = await supabase
      .from("attendance_records")
      .select(
        "id, student_id, enrollment_id, group_id, schedule_id, coach_id, lesson_date, status, coach_note, recorded_by, updated_by, edited_at, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("group_id", input.groupId)
      .gte("lesson_date", startDate)
      .lt("lesson_date", nextMonth)
      .order("lesson_date", {
        ascending: true,
      });

    if (error) {
      return {
        ok: false,
        records: [],
        message: `Aylık yoklama yüklenemedi: ${error.message}`,
      };
    }

    return {
      ok: true,
      records: data || [],
      message: "Aylık yoklama başarıyla yüklendi.",
    };
  } catch (error) {
    return {
      ok: false,
      records: [],
      message:
        error instanceof Error
          ? error.message
          : "Aylık yoklama yüklenemedi.",
    };
  }
}
