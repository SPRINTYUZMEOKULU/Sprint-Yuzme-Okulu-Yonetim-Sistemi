"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type StudentListItem = {
  id: string;
  student_number?: string | null;
  first_name: string;
  last_name: string;

  status?: string | null;
  swimming_level?: string | null;

  branch_id?: string | null;
  branch_name?: string | null;

  group_id?: string | null;
  group_name?: string | null;

  course_type?: string | null;

  package_name?: string | null;
  package_lesson_count?: number | null;

  compensation_lessons?: number | null;
  used_lessons?: number | null;
  remaining_lessons?: number | null;

  start_date?: string | null;
  normal_end_date?: string | null;
  compensation_end_date?: string | null;
  end_date?: string | null;

  phone?: string | null;
  guardian_phone?: string | null;
  guardian_name?: string | null;
  email?: string | null;
  guardian_email?: string | null;

  planned_compensation_lessons?: number | null;

  payment_status?: string | null;
  payment_total_received?: number | null;
  payment_outstanding?: number | null;
  last_payment_at?: string | null;

  last_attendance_date?: string | null;
  last_attendance_status?: string | null;
  last_absent_date?: string | null;

  next_compensation_date?: string | null;
  next_compensation_group?: string | null;
  next_compensation_start_time?: string | null;
  next_compensation_end_time?: string | null;

  created_at?: string | null;
};

type Props = {
  students: StudentListItem[];
};

type StatusFilter =
  | "all"
  | "active"
  | "passive"
  | "pre_registration"
  | "ending_soon";

type SortType =
  | "name_asc"
  | "name_desc"
  | "start_new"
  | "start_old"
  | "end_near"
  | "remaining_desc"
  | "remaining_asc";

type MessageType =
  | "smart"
  | "renewal"
  | "freeze"
  | "compensation"
  | "absence"
  | "payment"
  | "lesson_ending"
  | "lesson_finished"
  | "program"
  | "registration"
  | "general";

const statusLabels: Record<string, string> = {
  active: "Aktif",
  passive: "Pasif",
  pre_registration: "Ön Kayıt",
  waiting_contact: "İletişim Bekliyor",
  trial_lesson: "Deneme Dersi",
  waiting_payment: "Ödeme Bekliyor",
  waiting_approval: "Onay Bekliyor",
  frozen: "Dondurulmuş",
  cancelled: "İptal",
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizeText(value?: string | null) {
  return (value || "").toLocaleLowerCase("tr-TR").trim();
}

function isEndingSoon(dateValue?: string | null) {
  if (!dateValue) return false;

  const end = new Date(dateValue);
  if (Number.isNaN(end.getTime())) return false;

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const difference = end.getTime() - today.getTime();
  const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

  return days >= 0 && days <= 7;
}

function numberValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function cleanPhone(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function isAdultCourse(courseType?: string | null) {
  const value = normalizeText(courseType);
  return (
    value.includes("yetişkin") ||
    value.includes("yetiskin") ||
    value.includes("adult")
  );
}

function contactPhone(student: StudentListItem) {
  const adult = isAdultCourse(student.course_type);
  const first = adult ? student.phone : student.guardian_phone;
  const second = adult ? student.guardian_phone : student.phone;

  return cleanPhone(first) || cleanPhone(second);
}

function whatsappPhone(value: string) {
  const phone = cleanPhone(value);

  if (phone.startsWith("90")) return phone;
  if (phone.startsWith("0")) return `90${phone.slice(1)}`;
  if (phone.length === 10) return `90${phone}`;

  return phone;
}

function daysUntil(value?: string | null) {
  if (!value) return null;

  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.ceil(
    (end.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function paymentLabel(student: StudentListItem) {
  const outstanding = numberValue(student.payment_outstanding);
  const raw = normalizeText(student.payment_status);

  if (outstanding > 0) {
    return {
      text: "Ödeme Bekliyor",
      className: "paymentWarn",
    };
  }

  if (
    raw.includes("paid") ||
    raw.includes("ödendi") ||
    raw.includes("odendi") ||
    numberValue(student.payment_total_received) > 0
  ) {
    return {
      text: "Ödeme Kaydı Var",
      className: "paymentOk",
    };
  }

  return {
    text: "Ödeme Kaydı Yok",
    className: "paymentNeutral",
  };
}

function buildMessage(
  student: StudentListItem,
  type: MessageType
) {
  const adult = isAdultCourse(student.course_type);
  const name = `${student.first_name} ${student.last_name}`.trim();
  const remaining = numberValue(student.remaining_lessons);
  const endDate =
    student.compensation_end_date ||
    student.normal_end_date ||
    student.end_date;
  const endText = formatDate(endDate);
  const startText = formatDate(student.start_date);
  const outstanding = numberValue(student.payment_outstanding);
  const compensationDate = formatDate(student.next_compensation_date);
  const compensationTime = [
    student.next_compensation_start_time?.slice(0, 5),
    student.next_compensation_end_time?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(" - ");
  const groupText = student.next_compensation_group || student.group_name || "";
  const lastAbsent = formatDate(student.last_absent_date);

  const opening = "Merhaba, Sprint Yüzme Okulu'ndan bilgilendirme için yazıyoruz.";
  const closing = "Bilginize sunar, iyi günler dileriz.\nSprint Yüzme Okulu";

  if (type === "smart") {
    if (remaining <= 0) return buildMessage(student, "lesson_finished");
    if (outstanding > 0) return buildMessage(student, "payment");
    if (student.next_compensation_date) return buildMessage(student, "compensation");
    if (student.last_absent_date) return buildMessage(student, "absence");
    if (remaining <= 3 || isEndingSoon(endDate)) return buildMessage(student, "renewal");
    return buildMessage(student, "registration");
  }

  if (type === "renewal") {
    return adult
      ? `${opening}\n\nKayıt yenileme döneminiz yaklaşmaktadır. Mevcut kaydınızın planlanan bitiş tarihi ${endText} olup kalan ders hakkınız ${remaining} derstir. Ders planlamanızın aksamaması için kayıt yenileme işleminizi tamamlamanızı rica ederiz.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin kayıt yenileme dönemi yaklaşmaktadır. Mevcut kaydının planlanan bitiş tarihi ${endText} olup kalan ders hakkı ${remaining} derstir. Ders planlamasının aksamaması için kayıt yenileme işleminizi tamamlamanızı rica ederiz.\n\n${closing}`;
  }

  if (type === "freeze") {
    return adult
      ? `${opening}\n\nKayıt dondurma işleminiz sistemimize işlenmiştir. Güncel ders ve kayıt planınızı Öğrenci Merkezi üzerinden takip edebilirsiniz.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin kayıt dondurma işlemi sistemimize işlenmiştir. Güncel ders ve kayıt planını Öğrenci Merkezi üzerinden takip edebilirsiniz.\n\n${closing}`;
  }

  if (type === "compensation") {
    if (!student.next_compensation_date) {
      return `${opening}\n\nBu öğrenci için planlanmış aktif bir telafi dersi bulunmamaktadır.\n\n${closing}`;
    }

    const detail = [
      compensationDate,
      compensationTime,
      groupText,
    ]
      .filter(Boolean)
      .join(" · ");

    return adult
      ? `${opening}\n\nTelafi dersiniz planlanmıştır. Telafi ders bilginiz: ${detail}. Belirtilen tarih ve saatte dersinize katılım sağlamanızı rica ederiz.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin telafi dersi planlanmıştır. Telafi ders bilgisi: ${detail}. Belirtilen tarih ve saatte derse katılım sağlamasını rica ederiz.\n\n${closing}`;
  }

  if (type === "absence") {
    if (!student.last_absent_date) {
      return `${opening}\n\nBu öğrenci için kayıtlı bir gelmedi yoklaması bulunmamaktadır.\n\n${closing}`;
    }

    return adult
      ? `${opening}\n\n${lastAbsent} tarihli yüzme dersinize katılım sağlamadığınız görülmüştür. Bu mesaj bilgilendirme amacıyla gönderilmiştir.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin ${lastAbsent} tarihli yüzme dersine katılım sağlamadığı görülmüştür. Bu mesaj bilgilendirme amacıyla gönderilmiştir.\n\n${closing}`;
  }

  if (type === "payment") {
    if (outstanding <= 0) {
      return `${opening}\n\nAktif kayıt dönemine ait bekleyen ödeme görünmemektedir.\n\n${closing}`;
    }

    const amount = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(outstanding);

    return adult
      ? `${opening}\n\nAktif kayıt paketinize ait ${amount} tutarında bekleyen ödemeniz bulunmaktadır. Ödeme planınızla ilgili bilgi almak için bizimle iletişime geçebilirsiniz.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin aktif kayıt paketine ait ${amount} tutarında bekleyen ödeme bulunmaktadır. Ödeme planıyla ilgili bilgi almak için bizimle iletişime geçebilirsiniz.\n\n${closing}`;
  }

  if (type === "lesson_ending") {
    return adult
      ? `${opening}\n\nMevcut paketinizde ${remaining} ders hakkınız kalmıştır. Kayıt yenileme döneminiz yaklaşmaktadır. Ders planlamanızın kesintiye uğramaması için yenileme işleminizi planlamanızı rica ederiz.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin mevcut paketinde ${remaining} ders hakkı kalmıştır. Kayıt yenileme dönemi yaklaşmaktadır. Ders planlamasının kesintiye uğramaması için yenileme işleminizi planlamanızı rica ederiz.\n\n${closing}`;
  }

  if (type === "lesson_finished") {
    return adult
      ? `${opening}\n\nMevcut paketinizdeki ders hakkınız tamamlanmıştır. Ders takibiniz sona ermiştir. Derslerinize devam edebilmeniz için kayıt yenileme işleminizin yapılması gerekmektedir.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin mevcut paketindeki ders hakkı tamamlanmıştır. Ders takibi sona ermiştir. Derslerine devam edebilmesi için kayıt yenileme işleminin yapılması gerekmektedir.\n\n${closing}`;
  }

  if (type === "program") {
    return adult
      ? `${opening}\n\nGüncel yüzme grubunuz: ${student.group_name || "—"}. Şubeniz: ${student.branch_name || "—"}. Ders programınızla ilgili değişiklik olması halinde ayrıca bilgilendirileceksiniz.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin güncel yüzme grubu: ${student.group_name || "—"}. Şubesi: ${student.branch_name || "—"}. Ders programında değişiklik olması halinde ayrıca bilgilendirileceksiniz.\n\n${closing}`;
  }

  if (type === "registration") {
    return adult
      ? `${opening}\n\nKaydınız oluşturulmuştur. Paketiniz: ${student.package_name || "—"}. Başlangıç tarihiniz ${startText}, planlanan bitiş tarihiniz ${endText}. Grubunuz: ${student.group_name || "—"}.\n\n${closing}`
      : `${opening}\n\n${name} isimli öğrencimizin kaydı oluşturulmuştur. Paketi: ${student.package_name || "—"}. Başlangıç tarihi ${startText}, planlanan bitiş tarihi ${endText}. Grubu: ${student.group_name || "—"}.\n\n${closing}`;
  }

  return adult
    ? `${opening}\n\nKurs kaydınızla ilgili bilgilendirme için iletişime geçiyoruz.\n\n${closing}`
    : `${opening}\n\n${name} isimli öğrencimizin kurs kaydıyla ilgili bilgilendirme için iletişime geçiyoruz.\n\n${closing}`;
}

export default function StudentsClient({ students }: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [branch, setBranch] = useState("all");
  const [group, setGroup] = useState("all");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState<SortType>("name_asc"); 
  const [actionStudent, setActionStudent] =
  useState<StudentListItem | null>(null);

const [actionType, setActionType] = useState<
  | "individual_compensation"
  | "lesson_count_change"
  | "bulk_compensation"
  | null
>(null);

const [lessonCount, setLessonCount] = useState("1");
const [reason, setReason] = useState("");
const [description, setDescription] = useState("");

const [submitting, setSubmitting] = useState(false);
const [actionMessage, setActionMessage] = useState("");
const [statusActionStudent, setStatusActionStudent] =
  useState<StudentListItem | null>(null);

const [statusReason, setStatusReason] = useState("");
const [statusDescription, setStatusDescription] = useState("");
const [statusSubmitting, setStatusSubmitting] = useState(false);
const [statusActionMessage, setStatusActionMessage] = useState(""); 
const [pendingStatusStudentIds, setPendingStatusStudentIds] = useState<string[]>([]);

const [deleteActionStudent, setDeleteActionStudent] =
  useState<StudentListItem | null>(null);
const [deleteReason, setDeleteReason] = useState("");
const [deleteDescription, setDeleteDescription] = useState("");
const [deleteSubmitting, setDeleteSubmitting] = useState(false);
const [deleteActionMessage, setDeleteActionMessage] = useState("");
const [pendingDeleteStudentIds, setPendingDeleteStudentIds] = useState<string[]>([]);

const [messageStudent, setMessageStudent] = useState<StudentListItem | null>(null);
const [messageType, setMessageType] = useState<MessageType>("smart");
const [messageText, setMessageText] = useState("");

useEffect(() => {
  async function loadPendingStatusRequests() {
    try {
      const response = await fetch("/api/student-status-requests", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        console.error("Bekleyen pasife alma talepleri alınamadı:", result);
        return;
      }

      const requests = (result.requests ?? []) as Array<{
        student_id?: string | null;
        request_type?: string | null;
      }>;

      const deactivateIds = requests
        .filter(
          (request) =>
            !request.request_type ||
            request.request_type === "deactivate"
        )
        .map((request) => request.student_id)
        .filter(
          (id: string | null | undefined): id is string =>
            Boolean(id)
        );

      const deleteIds = requests
        .filter(
          (request) =>
            request.request_type === "delete"
        )
        .map((request) => request.student_id)
        .filter(
          (id: string | null | undefined): id is string =>
            Boolean(id)
        );

      setPendingStatusStudentIds(deactivateIds);
      setPendingDeleteStudentIds(deleteIds);
    } catch (error) {
      console.error("Bekleyen pasife alma talepleri alınamadı:", error);
    }
  }

  loadPendingStatusRequests();
}, []);
async function submitLessonAdjustment() {
  if (!actionType) return;

  const count = Number(lessonCount);

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    setActionMessage("Ders sayısı 1 ile 100 arasında olmalıdır.");
    return;
  }

  if (!reason.trim()) {
    setActionMessage("İşlem gerekçesi yazılmalıdır.");
    return;
  }

  setSubmitting(true);
  setActionMessage("");

  try {
    const response = await fetch("/api/lesson-adjustments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        request_type: actionType,

        student_id:
          actionType === "individual_compensation" ||
          actionType === "lesson_count_change"
            ? actionStudent?.id
            : null,

        branch_id:
          actionType === "bulk_compensation"
            ? actionStudent?.branch_id
            : actionStudent?.branch_id ?? null,

        group_id: actionStudent?.group_id ?? null,

        lesson_count: count,
        reason: reason.trim(),
        description: description.trim(),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      setActionMessage(
        result.error ||
          result.details ||
          "İşlem talebi oluşturulamadı."
      );
      return;
    }

    setActionMessage(
      result.message ||
        "Talep yönetici onayına gönderildi."
    );

    setLessonCount("1");
    setReason("");
    setDescription("");
  } catch (error) {
    console.error(error);
    setActionMessage(
      "Sunucuya bağlanırken bir hata oluştu."
    );
  } finally {
    setSubmitting(false);
  }
}
async function submitStatusChangeRequest() {
  if (!statusActionStudent) return;

  if (!statusReason.trim()) {
    setStatusActionMessage("Pasife alma gerekçesi seçilmelidir.");
    return;
  }

  try {
    setStatusSubmitting(true);
    setStatusActionMessage("");

    const response = await fetch("/api/student-status-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        request_type: "deactivate",
        student_id: statusActionStudent.id,
        branch_id: statusActionStudent.branch_id || null,
        group_id: statusActionStudent.group_id || null,
        reason: statusReason,
        description: statusDescription,
        old_status: statusActionStudent.status || "active",
        new_status: "passive",
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      setStatusActionMessage(
        result.error ||
          result.details ||
          "Pasife alma talebi oluşturulamadı."
      );
      return;
    }
setPendingStatusStudentIds((prev) =>
  statusActionStudent
    ? Array.from(new Set([...prev, statusActionStudent.id]))
    : prev
);
    setStatusActionMessage(
      result.message || "Pasife alma talebi yönetici onayına gönderildi."
    );
  } catch (error) {
    console.error(error);
    setStatusActionMessage("Sunucuya bağlanırken bir hata oluştu.");
  } finally {
    setStatusSubmitting(false);
  }
}

async function submitDeleteRequest() {
  if (!deleteActionStudent) return;

  if (!deleteReason.trim()) {
    setDeleteActionMessage("Üye silme gerekçesi seçilmelidir.");
    return;
  }

  try {
    setDeleteSubmitting(true);
    setDeleteActionMessage("");

    const response = await fetch("/api/student-status-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        request_type: "delete",
        student_id: deleteActionStudent.id,
        branch_id: deleteActionStudent.branch_id || null,
        group_id: deleteActionStudent.group_id || null,
        reason: deleteReason,
        description: deleteDescription,
        old_status: deleteActionStudent.status || "active",
        new_status: "deleted",
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      setDeleteActionMessage(
        result.error ||
          result.details ||
          "Üye silme talebi oluşturulamadı."
      );
      return;
    }

    setPendingDeleteStudentIds((prev) =>
      deleteActionStudent
        ? Array.from(new Set([...prev, deleteActionStudent.id]))
        : prev
    );

    setDeleteActionMessage(
      result.message ||
        "Üye silme talebi yönetici onayına gönderildi."
    );
  } catch (error) {
    console.error(error);
    setDeleteActionMessage(
      "Sunucuya bağlanırken bir hata oluştu."
    );
  } finally {
    setDeleteSubmitting(false);
  }
}

function closeDeleteAction() {
  setDeleteActionStudent(null);
  setDeleteReason("");
  setDeleteDescription("");
  setDeleteActionMessage("");
}

function closeStatusAction() {
  setStatusActionStudent(null);
  setStatusReason("");
  setStatusDescription("");
  setStatusActionMessage("");
}
function closeLessonAction() {
  setActionStudent(null);
  setActionType(null);
  setLessonCount("1");
  setReason("");
  setDescription("");
  setActionMessage("");
}

  const branches = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map((student) => student.branch_name)
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [students]);

  const groups = useMemo(() => {
    return Array.from(
      new Set(
        students
          .filter(
            (student) =>
              branch === "all" || student.branch_name === branch
          )
          .map((student) => student.group_name)
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [students, branch]);

  const levels = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map((student) => student.swimming_level)
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [students]);

  const counts = useMemo(() => {
    return {
      total: students.length,
      active: students.filter((student) => student.status === "active").length,
      passive: students.filter((student) => student.status === "passive").length,
      preRegistration: students.filter(
        (student) => student.status === "pre_registration"
      ).length,
      endingSoon: students.filter(
        (student) =>
          student.status === "active" &&
          (
            isEndingSoon(
              student.compensation_end_date ||
                student.normal_end_date ||
                student.end_date
            ) ||
            numberValue(student.remaining_lessons) <= 3
          )
      ).length,
      lessonEnded: students.filter(
        (student) =>
          student.status === "active" &&
          numberValue(student.remaining_lessons) <= 0
      ).length,
      paymentWaiting: students.filter(
        (student) =>
          numberValue(student.payment_outstanding) > 0
      ).length,
      compensationWaiting: students.filter(
        (student) =>
          numberValue(student.planned_compensation_lessons) > 0
      ).length,
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = normalizeText(search);

    const result = students.filter((student) => {
      const fullName = `${student.first_name || ""} ${
        student.last_name || ""
      }`.trim();

      const searchMatch =
        !query ||
        normalizeText(fullName).includes(query) ||
        normalizeText(student.branch_name).includes(query) ||
        normalizeText(student.group_name).includes(query) ||
        normalizeText(student.phone).includes(query) ||
        normalizeText(student.guardian_phone).includes(query);

      const branchMatch =
        branch === "all" || student.branch_name === branch;

      const groupMatch =
        group === "all" || student.group_name === group;

      const levelMatch =
        level === "all" || student.swimming_level === level;

      let statusMatch = true;

      if (status === "active") {
        statusMatch = student.status === "active";
      }

      if (status === "passive") {
        statusMatch = student.status === "passive";
      }

      if (status === "pre_registration") {
        statusMatch = student.status === "pre_registration";
      }

      if (status === "ending_soon") {
        statusMatch =
          student.status === "active" && isEndingSoon(student.end_date);
      }

      return (
        searchMatch &&
        branchMatch &&
        groupMatch &&
        levelMatch &&
        statusMatch
      );
    });

    return [...result].sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`;
      const nameB = `${b.first_name} ${b.last_name}`;

      if (sort === "name_asc") {
        return nameA.localeCompare(nameB, "tr");
      }

      if (sort === "name_desc") {
        return nameB.localeCompare(nameA, "tr");
      }

      if (sort === "start_new") {
        return (
          new Date(b.start_date || 0).getTime() -
          new Date(a.start_date || 0).getTime()
        );
      }

      if (sort === "start_old") {
        return (
          new Date(a.start_date || 0).getTime() -
          new Date(b.start_date || 0).getTime()
        );
      }

      if (sort === "end_near") {
        const timeA = a.end_date
          ? new Date(a.end_date).getTime()
          : Number.MAX_SAFE_INTEGER;

        const timeB = b.end_date
          ? new Date(b.end_date).getTime()
          : Number.MAX_SAFE_INTEGER;

        return timeA - timeB;
      }

      if (sort === "remaining_desc") {
        return (
          numberValue(b.remaining_lessons) -
          numberValue(a.remaining_lessons)
        );
      }

      if (sort === "remaining_asc") {
        return (
          numberValue(a.remaining_lessons) -
          numberValue(b.remaining_lessons)
        );
      }

      return 0;
    });
  }, [students, search, status, branch, group, level, sort]);

  function callStudent(student: StudentListItem) {
    const phone = contactPhone(student);

    if (!phone) {
      alert("İletişim telefonu bulunamadı.");
      return;
    }

    window.location.href = `tel:${phone}`;
  }

  function whatsappStudent(student: StudentListItem) {
    const phone = contactPhone(student);

    if (!phone) {
      alert("WhatsApp için telefon numarası bulunamadı.");
      return;
    }

    window.open(
      `https://wa.me/${whatsappPhone(phone)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function openMessageCenter(student: StudentListItem) {
    const suggestedType: MessageType =
      numberValue(student.remaining_lessons) <= 0
        ? "lesson_finished"
        : numberValue(student.payment_outstanding) > 0
        ? "payment"
        : student.next_compensation_date
        ? "compensation"
        : numberValue(student.remaining_lessons) <= 3 ||
          isEndingSoon(
            student.compensation_end_date ||
              student.normal_end_date ||
              student.end_date
          )
        ? "renewal"
        : student.last_absent_date
        ? "absence"
        : "smart";

    setMessageStudent(student);
    setMessageType(suggestedType);
    setMessageText(buildMessage(student, suggestedType));
  }

  function changeMessageType(type: MessageType) {
    setMessageType(type);

    if (messageStudent) {
      setMessageText(buildMessage(messageStudent, type));
    }
  }

  function closeMessageCenter() {
    setMessageStudent(null);
    setMessageType("smart");
    setMessageText("");
  }

  function sendMessageToWhatsApp() {
    if (!messageStudent) return;

    const phone = contactPhone(messageStudent);

    if (!phone) {
      alert("Hazır mesaj için telefon numarası bulunamadı.");
      return;
    }

    window.open(
      `https://wa.me/${whatsappPhone(phone)}?text=${encodeURIComponent(messageText)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function exportCSV() {
    const headers = [
      "Öğrenci",
      "Durum",
      "Şube",
      "Grup",
      "Seviye",
      "Paket",
      "Normal Ders",
      "Telafi",
      "Toplam Hak",
      "Kullanılan",
      "Kalan",
      "Başlangıç",
      "Bitiş",
      "Telefon",
    ];

    const rows = filteredStudents.map((student) => {
      const normalLessons = numberValue(student.package_lesson_count);
      const compensation = numberValue(student.compensation_lessons);
      const totalRights = normalLessons + compensation;

      return [
        `${student.first_name} ${student.last_name}`,
        statusLabels[student.status || ""] || student.status || "",
        student.branch_name || "",
        student.group_name || "",
        student.swimming_level || "",
        student.package_name || "",
        normalLessons,
        compensation,
        totalRights,
        numberValue(student.used_lessons),
        numberValue(student.remaining_lessons),
        formatDate(student.start_date),
        formatDate(student.end_date),
        student.phone || student.guardian_phone || "",
      ];
    });

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(";")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `SprintOS-Ogrenciler-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="studentCenter"> 
      <div
  style={{
    display: "flex",
    gap: "10px",
    alignItems: "center",
    marginBottom: "16px",
  }}
>
  <button
    type="button"
    onClick={() => router.back()}
    style={{
      padding: "10px 16px",
      border: "1px solid #dbe4f0",
      borderRadius: "10px",
      background: "#ffffff",
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    ← Geri
  </button>

  <button
    type="button"
    onClick={() => router.push("/")}
    style={{
      padding: "10px 16px",
      border: "none",
      borderRadius: "10px",
      background: "#1671e8",
      color: "#ffffff",
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    ⌂ Ana Sayfa
  </button>
</div>
      <section className="summaryGrid">
        <button
          className={`summaryCard ${status === "all" ? "selected" : ""}`}
          onClick={() => setStatus("all")}
        >
          <span>Toplam Öğrenci</span>
          <strong>{counts.total}</strong>
        </button>

        <button
          className={`summaryCard ${status === "active" ? "selected" : ""}`}
          onClick={() => setStatus("active")}
        >
          <span>Aktif Öğrenci</span>
          <strong>{counts.active}</strong>
        </button>

        <button
          className={`summaryCard ${
            status === "pre_registration" ? "selected" : ""
          }`}
          onClick={() => setStatus("pre_registration")}
        >
          <span>Ön Kayıt</span>
          <strong>{counts.preRegistration}</strong>
        </button>

        <button
          className={`summaryCard ${status === "passive" ? "selected" : ""}`}
          onClick={() => setStatus("passive")}
        >
          <span>Pasif</span>
          <strong>{counts.passive}</strong>
        </button>

        <button
          className={`summaryCard ${
            status === "ending_soon" ? "selected" : ""
          }`}
          onClick={() => setStatus("ending_soon")}
        >
          <span>Bitişi Yaklaşan</span>
          <strong>{counts.endingSoon}</strong>
        </button>

        <div className="summaryCard alertCard">
          <span>Ders Hakkı Biten</span>
          <strong>{counts.lessonEnded}</strong>
        </div>

        <div className="summaryCard warningCard">
          <span>Ödeme Bekleyen</span>
          <strong>{counts.paymentWaiting}</strong>
        </div>

        <div className="summaryCard infoCard">
          <span>Telafi Bekleyen</span>
          <strong>{counts.compensationWaiting}</strong>
        </div>
      </section>

      <section className="toolbar">
        <div className="searchBox">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Öğrenci, telefon, şube veya grup ara..."
          />
        </div>

        <select
          value={branch}
          onChange={(event) => {
            setBranch(event.target.value);
            setGroup("all");
          }}
        >
          <option value="all">Tüm Şubeler</option>

          {branches.map((branchName) => (
            <option key={branchName} value={branchName}>
              {branchName}
            </option>
          ))}
        </select>

        <select
          value={group}
          onChange={(event) => setGroup(event.target.value)}
        >
          <option value="all">Tüm Gruplar</option>

          {groups.map((groupName) => (
            <option key={groupName} value={groupName}>
              {groupName}
            </option>
          ))}
        </select>

        <select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        >
          <option value="all">Tüm Seviyeler</option>

          {levels.map((levelName) => (
            <option key={levelName} value={levelName}>
              {levelName}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortType)}
        >
          <option value="name_asc">Ad Soyad A-Z</option>
          <option value="name_desc">Ad Soyad Z-A</option>
          <option value="start_new">Yeni Başlayanlar</option>
          <option value="start_old">Eski Başlayanlar</option>
          <option value="end_near">Bitiş Tarihi Yakın</option>
          <option value="remaining_desc">Kalan Ders Çoktan Aza</option>
          <option value="remaining_asc">Kalan Ders Azdan Çoğa</option>
        </select>

        <button className="exportButton" onClick={exportCSV}>
          Excel&apos;e Aktar
        </button>
      </section>

      <div className="resultInfo">
        <strong>{filteredStudents.length}</strong> öğrenci gösteriliyor
      </div>

      <section className="studentGrid">
        {filteredStudents.map((student, index) => {
          const normalLessons = numberValue(student.package_lesson_count);
          const compensation = numberValue(student.compensation_lessons);
          const used = numberValue(student.used_lessons);

          const totalRights = normalLessons + compensation;

          const remaining =
            student.remaining_lessons != null
              ? numberValue(student.remaining_lessons)
              : Math.max(totalRights - used, 0);

          const effectiveEndDate =
            student.compensation_end_date ||
            student.normal_end_date ||
            student.end_date;

          const endDays = daysUntil(effectiveEndDate);
          const lessonEnded = remaining <= 0;
          const renewalWarning =
            !lessonEnded &&
            (
              remaining <= 3 ||
              (endDays !== null && endDays >= 0 && endDays <= 7)
            );

          const payment = paymentLabel(student);
          const phone = contactPhone(student);

          return (
            <article
              key={student.id}
              className="studentCard"
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/ogrenciler/${student.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  router.push(`/ogrenciler/${student.id}`);
                }
              }}
            >
              <header className="cardHeader">
                <div>
                  <span className="eyebrow">
                    #{index + 1} · {student.student_number || "ÖĞRENCİ NO YOK"}
                  </span>

                  <h3>
                    {student.first_name} {student.last_name}
                  </h3>
                </div>

                <span
                  className={`statusBadge ${
                    student.status === "active"
                      ? "green"
                      : student.status === "passive"
                      ? "red"
                      : "orange"
                  }`}
                >
                  {statusLabels[student.status || ""] ||
                    student.status ||
                    "Durum Yok"}
                </span>
              </header>

              {lessonEnded && (
                <div className="studentWarning dangerWarning">
                  <strong>🔴 DERS HAKKI KALMAMIŞTIR</strong>
                  <span>
                    Ders takibi tamamlanmıştır. Kayıt yenileme gereklidir.
                  </span>
                </div>
              )}

              {renewalWarning && (
                <div className="studentWarning renewalWarning">
                  <strong>⚠ KAYIT YENİLEME YAKLAŞIYOR</strong>
                  <span>
                    {remaining <= 3
                      ? `${remaining} ders kaldı.`
                      : ""}
                    {endDays !== null && endDays >= 0 && endDays <= 7
                      ? ` Bitiş tarihine ${endDays} gün kaldı.`
                      : ""}
                  </span>
                </div>
              )}

              <div className="mainDetails">
                <div>
                  <span>Şube</span>
                  <strong>{student.branch_name || "—"}</strong>
                </div>

                <div>
                  <span>Grup</span>
                  <strong>{student.group_name || "—"}</strong>
                </div>

                <div>
                  <span>Seviye</span>
                  <strong>{student.swimming_level || "—"}</strong>
                </div>

                <div>
                  <span>Paket</span>
                  <strong>
                    {student.package_name ||
                      (normalLessons > 0
                        ? `${normalLessons} Ders`
                        : "—")}
                  </strong>
                </div>
              </div>

              <div className="lessonStrip">
                <div>
                  <span>Normal</span>
                  <strong>{normalLessons}</strong>
                </div>

                <div className="compensation">
                  <span>Telafi</span>
                  <strong>+{compensation}</strong>
                </div>

                <div>
                  <span>Toplam Hak</span>
                  <strong>{totalRights}</strong>
                </div>

                <div>
                  <span>Kullanılan</span>
                  <strong>{used}</strong>
                </div>

                <div className="remaining">
                  <span>Kalan</span>
                  <strong>{remaining}</strong>
                </div>
              </div>

              <div className="dateRow">
                <div>
                  <span>Başlangıç</span>
                  <strong>{formatDate(student.start_date)}</strong>
                </div>

                <div>
                  <span>Normal Bitiş</span>
                  <strong>{formatDate(student.normal_end_date)}</strong>
                </div>

                <div>
                  <span>Telafili Bitiş</span>
                  <strong>{formatDate(student.compensation_end_date)}</strong>
                </div>

                <div>
                  <span>Ödeme</span>
                  <strong className={payment.className}>
                    {payment.text}
                  </strong>
                </div>
              </div>

              <footer className="cardFooter">
  <div className="contactSummary">
    <span>İletişim</span>
    <strong>{phone || "Telefon bilgisi yok"}</strong>
  </div>

  <div className="studentActions">
    <button
      type="button"
      className="studentActionButton call"
      disabled={!phone}
      onClick={(event) => {
        event.stopPropagation();
        callStudent(student);
      }}
    >
      📞 Ara
    </button>

    <button
      type="button"
      className="studentActionButton whatsapp"
      disabled={!phone}
      onClick={(event) => {
        event.stopPropagation();
        whatsappStudent(student);
      }}
    >
      💬 WhatsApp
    </button>

    <button
      type="button"
      className="studentActionButton message"
      disabled={!phone}
      onClick={(event) => {
        event.stopPropagation();
        openMessageCenter(student);
      }}
    >
      ✉ Hazır Mesaj
    </button>
    <button
      type="button"
      className="studentActionButton"
      onClick={(event) => {
        event.stopPropagation();
        router.push(`/ogrenciler/${student.id}`);
      }}
    >
      Öğrenci Dosyası
    </button>

    <button
      type="button"
      className="studentActionButton primary"
      onClick={(event) => {
        event.stopPropagation();

        setActionStudent(student);
        setActionType("lesson_count_change");

        setLessonCount(
          String(
            student.package_lesson_count &&
              student.package_lesson_count > 0
              ? student.package_lesson_count
              : 8
          )
        );

        setReason("");
        setDescription("");
        setActionMessage("");
      }}
    >
      Ders / Paket Yönet
    </button>

    <button
      type="button"
      className="studentActionButton compensation"
      onClick={(event) => {
        event.stopPropagation();

        setActionStudent(student);
        setActionType("individual_compensation");

        setLessonCount("1");
        setReason("");
        setDescription("");
        setActionMessage("");
      }}
    >
      + Bireysel Telafi
    </button>
    {student.status === "active" && (
  <button
    type="button"
    className="studentActionButton passive"
    disabled={pendingStatusStudentIds.includes(student.id)}
    onClick={(event) => {
      event.stopPropagation();

      setStatusActionStudent(student);
      setStatusReason("");
      setStatusDescription("");
      setStatusActionMessage("");
    }}
  >
    {pendingStatusStudentIds.includes(student.id)
      ? "Pasif Talebi Bekliyor"
      : "Pasife Al"}
  </button>
)}

<button
  type="button"
  className="studentActionButton delete"
  disabled={pendingDeleteStudentIds.includes(student.id)}
  onClick={(event) => {
    event.stopPropagation();

    setDeleteActionStudent(student);
    setDeleteReason("");
    setDeleteDescription("");
    setDeleteActionMessage("");
  }}
>
  {pendingDeleteStudentIds.includes(student.id)
    ? "Silme Onayı Bekliyor"
    : "Üye Sil"}
</button>
  </div>
</footer>
            </article>
          );
        })}

        {filteredStudents.length === 0 && (
          <div className="emptyState">
            Seçtiğiniz filtrelere uygun öğrenci bulunamadı.
          </div>
        )}
        {actionType && (
  <div
    className="lessonActionOverlay"
    onClick={closeLessonAction}
  >
    <div
      className="lessonActionModal"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="lessonActionHeader">
        <div>
          <span className="eyebrow">
            {actionType === "individual_compensation"
              ? "BİREYSEL TELAFİ"
              : actionType === "lesson_count_change"
              ? "DERS / PAKET YÖNETİMİ"
              : "TOPLU TELAFİ"}
          </span>

          <h3>
            {actionStudent
              ? `${actionStudent.first_name} ${actionStudent.last_name}`
              : "Ders Yönetimi"}
          </h3>

          {actionStudent && (
            <p>
              {actionStudent.branch_name || "Şube yok"}
              {" · "}
              {actionStudent.group_name || "Grup yok"}
            </p>
          )}
        </div>

        <button
          type="button"
          className="modalCloseButton"
          onClick={closeLessonAction}
        >
          ×
        </button>
      </div>

      <div className="lessonActionBody">
        <label>
          <span>Ders Sayısı</span>

          <div className="quickLessonButtons">
            {[1, 2, 8, 10, 12].map((count) => (
              <button
                key={count}
                type="button"
                className={
                  lessonCount === String(count)
                    ? "quickLessonButton active"
                    : "quickLessonButton"
                }
                onClick={() => setLessonCount(String(count))}
              >
                {count}
              </button>
            ))}
          </div>

          <input
            type="number"
            min="1"
            max="100"
            value={lessonCount}
            onChange={(event) =>
              setLessonCount(event.target.value)
            }
            placeholder="Özel ders sayısı"
          />
        </label>

        <label>
          <span>Gerekçe</span>

          <select
            value={reason}
            onChange={(event) =>
              setReason(event.target.value)
            }
          >
            <option value="">Gerekçe seçin</option>

            {actionType === "individual_compensation" ? (
              <>
                <option value="Havuz kaynaklı ders iptali">
                  Havuz kaynaklı ders iptali
                </option>

                <option value="Yönetim kararı">
                  Yönetim kararı
                </option>

                <option value="Özel telafi onayı">
                  Özel telafi onayı
                </option>

                <option value="Diğer">
                  Diğer
                </option>
              </>
            ) : (
              <>
                <option value="Yeni kayıt paketi">
                  Yeni kayıt paketi
                </option>

                <option value="Kayıt yenileme">
                  Kayıt yenileme
                </option>

                <option value="Paket düzeltme">
                  Paket düzeltme
                </option>

                <option value="Yönetim kararı">
                  Yönetim kararı
                </option>

                <option value="Diğer">
                  Diğer
                </option>
              </>
            )}
          </select>
        </label>

        <label>
          <span>Açıklama / Not</span>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="İşlemin nedenini ve gerekli açıklamayı yazın..."
            rows={4}
          />
        </label>

        {actionMessage && (
          <div className="actionMessage">
            {actionMessage}
          </div>
        )}
      </div>

      <div className="lessonActionFooter">
        <button
          type="button"
          className="cancelActionButton"
          onClick={closeLessonAction}
          disabled={submitting}
        >
          Vazgeç
        </button>

        <button
          type="button"
          className="submitActionButton"
          onClick={submitLessonAdjustment}
          disabled={submitting}
        >
          {submitting
            ? "Gönderiliyor..."
            : "Yönetici Onayına Gönder"}
        </button>
      </div>
    </div>
  </div>
)} 
        {statusActionStudent && (
  <div
    className="lessonActionOverlay"
    onClick={closeStatusAction}
  >
    <div
      className="lessonActionModal"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="lessonActionHeader">
        <div>
          <span className="eyebrow">PASİFE ALMA TALEBİ</span>

          <h3>
            {statusActionStudent.first_name}{" "}
            {statusActionStudent.last_name}
          </h3>

          <p>
            {statusActionStudent.branch_name || "Şube yok"}
            {" · "}
            {statusActionStudent.group_name || "Grup yok"}
          </p>
        </div>

        <button
          type="button"
          className="modalCloseButton"
          onClick={closeStatusAction}
        >
          ×
        </button>
      </div>

      <div className="lessonActionBody">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "10px",
            marginBottom: "14px",
          }}
        >
          <div>
            <span
              style={{
                display: "block",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Mevcut Durum
            </span>
            <strong>Aktif</strong>
          </div>

          <div>
            <span
              style={{
                display: "block",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Kalan Ders
            </span>
            <strong>
              {numberValue(statusActionStudent.remaining_lessons)}
            </strong>
          </div>

          <div>
            <span
              style={{
                display: "block",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Bitiş Tarihi
            </span>
            <strong>
              {formatDate(statusActionStudent.end_date)}
            </strong>
          </div>

          <div>
            <span
              style={{
                display: "block",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              İşlem
            </span>
            <strong>Pasife Alma</strong>
          </div>
        </div>

        <label>
          <span>Pasife Alma Gerekçesi</span>

          <select
            value={statusReason}
            onChange={(event) =>
              setStatusReason(event.target.value)
            }
          >
            <option value="">Gerekçe seçin</option>
            <option value="Kursiyer / veli talebi">
              Kursiyer / veli talebi
            </option>
            <option value="Kayıt yenilenmedi">
              Kayıt yenilenmedi
            </option>
            <option value="Program / saat uyuşmazlığı">
              Program / saat uyuşmazlığı
            </option>
            <option value="Taşınma">
              Taşınma
            </option>
            <option value="Uzun süreli devamsızlık">
              Uzun süreli devamsızlık
            </option>
            <option value="Sağlık nedeniyle ara verme">
              Sağlık nedeniyle ara verme
            </option>
            <option value="Ödeme süreci">
              Ödeme süreci
            </option>
            <option value="Yönetim kararı">
              Yönetim kararı
            </option>
            <option value="Diğer">
              Diğer
            </option>
          </select>
        </label>

        <label>
          <span>Açıklama / Not</span>

          <textarea
            value={statusDescription}
            onChange={(event) =>
              setStatusDescription(event.target.value)
            }
            placeholder="Pasife alma işlemiyle ilgili açıklamayı yazın..."
            rows={4}
          />
        </label>

        {statusActionMessage && (
          <div className="actionMessage">
            {statusActionMessage}
          </div>
        )}

        <div
          style={{
            marginTop: "14px",
            padding: "12px",
            borderRadius: "10px",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            fontSize: "13px",
            lineHeight: "1.5",
          }}
        >
          Öğrenci, yönetici onayı verilene kadar aktif olarak
          kalacaktır. Onay sonrası pasif duruma alınacaktır.
        </div>
      </div>

      <div className="lessonActionFooter">
        <button
          type="button"
          className="cancelActionButton"
          onClick={closeStatusAction}
          disabled={statusSubmitting}
        >
          Vazgeç
        </button>

        <button
          type="button"
          className="submitActionButton"
          onClick={submitStatusChangeRequest}
          disabled={statusSubmitting}
        >
          {statusSubmitting
            ? "Gönderiliyor..."
            : "Yönetici Onayına Gönder"}
        </button>
      </div>
    </div>
  </div>
)}
      {messageStudent && (
        <div
          className="lessonActionOverlay"
          onClick={closeMessageCenter}
        >
          <div
            className="lessonActionModal messageCenterModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lessonActionHeader">
              <div>
                <span className="eyebrow">HAZIR MESAJ MERKEZİ</span>
                <h3>
                  {messageStudent.first_name} {messageStudent.last_name}
                </h3>
                <p>
                  {messageStudent.student_number || "Öğrenci No Yok"}
                  {" · "}
                  {messageStudent.group_name || "Grup yok"}
                </p>
              </div>

              <button
                type="button"
                className="modalCloseButton"
                onClick={closeMessageCenter}
              >
                ×
              </button>
            </div>

            <div className="lessonActionBody">
              <label>
                <span>Mesaj Türü</span>
                <select
                  value={messageType}
                  onChange={(event) =>
                    changeMessageType(event.target.value as MessageType)
                  }
                >
                  <option value="smart">✨ Akıllı Öneri</option>
                  <option value="renewal">🔄 Kayıt Yenileme</option>
                  <option value="freeze">⏸ Kayıt Dondurma</option>
                  <option value="compensation">➕ Telafi Bilgisi</option>
                  <option value="absence">❌ Devamsızlık / Gelmedi</option>
                  <option value="payment">💳 Ödeme Hatırlatma</option>
                  <option value="lesson_ending">⚠ Ders Hakkı Bitiyor</option>
                  <option value="lesson_finished">🔴 Ders Hakkı Bitti</option>
                  <option value="program">📅 Ders Programı</option>
                  <option value="registration">✅ Kayıt Onayı</option>
                  <option value="general">💬 Genel Bilgilendirme</option>
                </select>
              </label>

              <div className="messageDataGrid">
                <div>
                  <span>Kalan Ders</span>
                  <strong>{numberValue(messageStudent.remaining_lessons)}</strong>
                </div>
                <div>
                  <span>Bitiş</span>
                  <strong>
                    {formatDate(
                      messageStudent.compensation_end_date ||
                        messageStudent.normal_end_date ||
                        messageStudent.end_date
                    )}
                  </strong>
                </div>
                <div>
                  <span>Son Gelmedi</span>
                  <strong>{formatDate(messageStudent.last_absent_date)}</strong>
                </div>
                <div>
                  <span>Planlı Telafi</span>
                  <strong>{formatDate(messageStudent.next_compensation_date)}</strong>
                </div>
                <div>
                  <span>Bekleyen Ödeme</span>
                  <strong>
                    {new Intl.NumberFormat("tr-TR", {
                      style: "currency",
                      currency: "TRY",
                      maximumFractionDigits: 0,
                    }).format(numberValue(messageStudent.payment_outstanding))}
                  </strong>
                </div>
                <div>
                  <span>İletişim</span>
                  <strong>{contactPhone(messageStudent) || "—"}</strong>
                </div>
              </div>

              <label>
                <span>Mesaj Önizleme / Düzenleme</span>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  rows={10}
                  placeholder="Mesaj metni..."
                />
              </label>

              <div className="messageInfoBox">
                Mesaj, öğrencinin mevcut kayıt verilerine göre otomatik
                hazırlanır. Göndermeden önce metni değiştirebilirsiniz.
              </div>
            </div>

            <div className="lessonActionFooter">
              <button
                type="button"
                className="cancelActionButton"
                onClick={closeMessageCenter}
              >
                Vazgeç
              </button>

              <button
                type="button"
                className="whatsappSendButton"
                onClick={sendMessageToWhatsApp}
                disabled={!messageText.trim()}
              >
                💬 WhatsApp&apos;ta Aç
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteActionStudent && (
        <div
          className="lessonActionOverlay"
          onClick={closeDeleteAction}
        >
          <div
            className="lessonActionModal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lessonActionHeader">
              <div>
                <span className="eyebrow dangerEyebrow">
                  YÖNETİCİ ONAYLI ÜYE SİLME
                </span>

                <h3>
                  {deleteActionStudent.first_name}{" "}
                  {deleteActionStudent.last_name}
                </h3>

                <p>
                  {deleteActionStudent.branch_name || "Şube yok"}
                  {" · "}
                  {deleteActionStudent.group_name || "Grup yok"}
                </p>
              </div>

              <button
                type="button"
                className="modalCloseButton"
                onClick={closeDeleteAction}
              >
                ×
              </button>
            </div>

            <div className="lessonActionBody">
              <div className="deleteWarningBox">
                <strong>⚠ Üye doğrudan silinmeyecektir.</strong>
                <span>
                  Talep yönetici onayına gönderilir. Onay verilene
                  kadar öğrenci ve geçmiş kayıtları sistemde kalır.
                </span>
              </div>

              <label>
                <span>Silme Gerekçesi</span>
                <select
                  value={deleteReason}
                  onChange={(event) =>
                    setDeleteReason(event.target.value)
                  }
                >
                  <option value="">Gerekçe seçin</option>
                  <option value="Mükerrer öğrenci kaydı">
                    Mükerrer öğrenci kaydı
                  </option>
                  <option value="Hatalı oluşturulan kayıt">
                    Hatalı oluşturulan kayıt
                  </option>
                  <option value="Kursiyer / veli talebi">
                    Kursiyer / veli talebi
                  </option>
                  <option value="Yönetim kararı">
                    Yönetim kararı
                  </option>
                  <option value="Diğer">
                    Diğer
                  </option>
                </select>
              </label>

              <label>
                <span>Açıklama / Yönetici Notu</span>
                <textarea
                  value={deleteDescription}
                  onChange={(event) =>
                    setDeleteDescription(event.target.value)
                  }
                  placeholder="Üye silme talebinin nedenini ayrıntılı olarak yazın..."
                  rows={4}
                />
              </label>

              {deleteActionMessage && (
                <div className="actionMessage">
                  {deleteActionMessage}
                </div>
              )}

              <div className="deleteConfirmBox">
                <strong>Bu işlem onay gerektirir.</strong>
                <span>
                  Yönetici onayı verilmeden öğrenci kartı,
                  ders hakları, ödemeler veya yoklamalar kaldırılmaz.
                </span>
              </div>
            </div>

            <div className="lessonActionFooter">
              <button
                type="button"
                className="cancelActionButton"
                onClick={closeDeleteAction}
                disabled={deleteSubmitting}
              >
                Vazgeç
              </button>

              <button
                type="button"
                className="submitDeleteButton"
                onClick={submitDeleteRequest}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting
                  ? "Gönderiliyor..."
                  : "Silme Talebini Yönetici Onayına Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}

      </section>

      <style jsx>{`
      .studentActions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.studentActionButton {
  appearance: none;
  border: 1px solid #d7e0ec;
  background: #ffffff;
  color: #17345c;
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.18s ease;
}

.studentActionButton:hover {
  transform: translateY(-1px);
  border-color: #9eb9df;
}

.studentActionButton.primary {
  background: #1268d6;
  border-color: #1268d6;
  color: #ffffff;
}

.studentActionButton.compensation {
  background: #eef8f3;
  border-color: #b9e3ce;
  color: #13734c;
}


.studentActionButton.passive {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #9a3412;
}

.studentActionButton.delete {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}

.studentActionButton:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.dangerEyebrow {
  color: #be123c !important;
}

.deleteWarningBox,
.deleteConfirmBox {
  display: grid;
  gap: 6px;
  padding: 13px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.deleteWarningBox {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #9f1239;
}

.deleteConfirmBox {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
}

.submitDeleteButton {
  min-height: 46px;
  border: 0;
  border-radius: 11px;
  padding: 0 14px;
  background: #be123c;
  color: #ffffff;
  font-weight: 800;
  cursor: pointer;
}

.submitDeleteButton:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.messageCenterModal {
  width: min(700px, 100%);
}

.messageDataGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.messageDataGrid > div {
  padding: 10px 11px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.messageDataGrid span {
  display: block;
  font-size: 10px;
  color: #64748b;
  margin-bottom: 3px;
}

.messageDataGrid strong {
  font-size: 12px;
  color: #17233c;
}

.messageInfoBox {
  padding: 11px 13px;
  border-radius: 10px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  font-size: 12px;
  line-height: 1.5;
}

.whatsappSendButton {
  min-height: 46px;
  border: 0;
  border-radius: 11px;
  padding: 0 16px;
  background: #16a34a;
  color: #ffffff;
  font-weight: 800;
  cursor: pointer;
}

.whatsappSendButton:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .messageDataGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.lessonActionOverlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(5, 21, 43, 0.62);
  backdrop-filter: blur(5px);
}

.lessonActionModal {
  width: min(560px, 100%);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
}

.lessonActionHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 16px;
  border-bottom: 1px solid #edf1f6;
}

.lessonActionHeader h3 {
  margin: 5px 0 4px;
  font-size: 22px;
  color: #12284a;
}

.lessonActionHeader p {
  margin: 0;
  color: #6b7b90;
  font-size: 13px;
}

.modalCloseButton {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border: 0;
  border-radius: 50%;
  background: #f1f4f8;
  color: #334a69;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.lessonActionBody {
  display: grid;
  gap: 17px;
  padding: 20px 22px;
}

.lessonActionBody label {
  display: grid;
  gap: 8px;
}

.lessonActionBody label > span {
  color: #33445c;
  font-size: 13px;
  font-weight: 800;
}

.lessonActionBody input,
.lessonActionBody select,
.lessonActionBody textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d8e0eb;
  border-radius: 11px;
  background: #ffffff;
  padding: 12px 13px;
  color: #182d4a;
  font: inherit;
  outline: none;
}

.lessonActionBody input:focus,
.lessonActionBody select:focus,
.lessonActionBody textarea:focus {
  border-color: #2680eb;
  box-shadow: 0 0 0 3px rgba(38, 128, 235, 0.1);
}

.quickLessonButtons {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 7px;
}

.quickLessonButton {
  border: 1px solid #d8e0eb;
  border-radius: 9px;
  background: #ffffff;
  padding: 9px 5px;
  font-weight: 800;
  color: #36506f;
  cursor: pointer;
}

.quickLessonButton.active {
  border-color: #1268d6;
  background: #1268d6;
  color: #ffffff;
}

.actionMessage {
  padding: 11px 13px;
  border-radius: 10px;
  background: #f2f7ff;
  border: 1px solid #d4e5ff;
  color: #214d85;
  font-size: 13px;
  font-weight: 700;
}

.lessonActionFooter {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 10px;
  padding: 16px 22px 22px;
  border-top: 1px solid #edf1f6;
}

.cancelActionButton,
.submitActionButton {
  min-height: 46px;
  border-radius: 11px;
  font-weight: 800;
  cursor: pointer;
}

.cancelActionButton {
  border: 1px solid #d5dde8;
  background: #ffffff;
  color: #40546e;
}

.submitActionButton {
  border: 0;
  background: #1268d6;
  color: #ffffff;
}

.cancelActionButton:disabled,
.submitActionButton:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .studentActions {
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
  }

  .studentActionButton {
    width: 100%;
    min-height: 42px;
  }

 
.studentWarning {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
  padding: 11px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.45;
}

.studentWarning strong {
  font-size: 12px;
}

.dangerWarning {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #9f1239;
}

.renewalWarning {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
}

.contactSummary {
  display: grid;
  gap: 2px;
  min-width: 130px;
}

.contactSummary span {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 800;
  text-transform: uppercase;
}

.contactSummary strong {
  color: #17345c !important;
  font-size: 12px;
}

.studentActionButton.call {
  background: #eef6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.studentActionButton.whatsapp {
  background: #ecfdf3;
  border-color: #bbf7d0;
  color: #15803d;
}

.studentActionButton.message {
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #6d28d9;
}

.paymentOk {
  color: #15803d !important;
}

.paymentWarn {
  color: #be123c !important;
}

.paymentNeutral {
  color: #64748b !important;
}

.summaryCard.alertCard {
  border-color: #fecdd3;
  background: #fff1f2;
}

.summaryCard.warningCard {
  border-color: #fed7aa;
  background: #fff7ed;
}

.summaryCard.infoCard {
  border-color: #ddd6fe;
  background: #f5f3ff;
}

 .lessonActionOverlay {
    align-items: flex-end;
    padding: 0;
  }

  .lessonActionModal {
    width: 100%;
    max-height: 92vh;
    border-radius: 20px 20px 0 0;
  }

  .lessonActionHeader {
    padding: 18px 16px 14px;
  }

  .lessonActionBody {
    padding: 16px;
  }

  .lessonActionFooter {
    grid-template-columns: 1fr;
    padding: 14px 16px 18px;
  }

  .quickLessonButtons {
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  }
}
        .studentCenter {
          width: 100%;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .summaryCard {
          appearance: none;
          border: 1px solid #dbe4f0;
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .summaryCard:hover,
        .summaryCard.selected {
          border-color: #1671e8;
          box-shadow: 0 8px 24px rgba(22, 113, 232, 0.12);
          transform: translateY(-1px);
        }

        .summaryCard span {
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 8px;
        }

        .summaryCard strong {
          display: block;
          font-size: 26px;
          color: #10233f;
        }

        .toolbar {
          display: grid;
          grid-template-columns:
            minmax(220px, 1.5fr)
            repeat(4, minmax(135px, 1fr))
            auto;
          gap: 10px;
          margin-bottom: 14px;
        }

        .toolbar input,
        .toolbar select {
          width: 100%;
          min-height: 44px;
          border: 1px solid #d8e1ed;
          border-radius: 12px;
          background: #ffffff;
          padding: 0 12px;
          color: #16233d;
          outline: none;
        }

        .toolbar input:focus,
        .toolbar select:focus {
          border-color: #1671e8;
          box-shadow: 0 0 0 3px rgba(22, 113, 232, 0.1);
        }

        .exportButton {
          border: 0;
          border-radius: 12px;
          padding: 0 18px;
          min-height: 44px;
          background: #1671e8;
          color: #ffffff;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .resultInfo {
          color: #64748b;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .studentGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .studentCard {
          background: #ffffff;
          border: 1px solid #dfe7f1;
          border-radius: 18px;
          padding: 18px;
          cursor: pointer;
          transition: 0.2s ease;
          outline: none;
        }

        .studentCard:hover,
        .studentCard:focus {
          border-color: #1671e8;
          box-shadow: 0 12px 30px rgba(16, 35, 63, 0.1);
          transform: translateY(-2px);
        }

        .cardHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }

        .eyebrow {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #1671e8;
          margin-bottom: 5px;
        }

        .cardHeader h3 {
          margin: 0;
          color: #10233f;
          font-size: 19px;
        }

        .statusBadge {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .statusBadge.green {
          color: #087443;
          background: #e7f8ef;
        }

        .statusBadge.red {
          color: #b42318;
          background: #feeceb;
        }

        .statusBadge.orange {
          color: #9a5b00;
          background: #fff4dc;
        }

        .mainDetails {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .mainDetails div,
        .dateRow div {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
        }

        .mainDetails span,
        .dateRow span,
        .lessonStrip span {
          display: block;
          color: #7a889d;
          font-size: 10px;
          margin-bottom: 4px;
        }

        .mainDetails strong,
        .dateRow strong {
          color: #17233c;
          font-size: 13px;
        }

        .lessonStrip {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          background: #f7f9fc;
          padding: 10px;
          border-radius: 14px;
          margin-bottom: 14px;
        }

        .lessonStrip div {
          text-align: center;
          border-right: 1px solid #e3e8f0;
        }

        .lessonStrip div:last-child {
          border-right: 0;
        }

        .lessonStrip strong {
          font-size: 16px;
          color: #10233f;
        }

        .lessonStrip .compensation strong {
          color: #1671e8;
        }

        .lessonStrip .remaining strong {
          color: #087443;
        }

        .dateRow {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .cardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #edf0f4;
          font-size: 12px;
          color: #64748b;
        }

        .cardFooter strong {
          color: #1671e8;
        }

        .emptyState {
          grid-column: 1 / -1;
          border: 1px dashed #cfd9e6;
          border-radius: 16px;
          padding: 40px 20px;
          text-align: center;
          color: #64748b;
        }

        @media (max-width: 1050px) {
          .summaryGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .summaryGrid {
            display: flex;
            overflow-x: auto;
            padding-bottom: 5px;
          }

          .summaryCard {
            min-width: 145px;
          }

          .toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .searchBox,
          .exportButton {
            grid-column: 1 / -1;
          }

          .studentGrid {
            grid-template-columns: 1fr;
          }

          .studentCard {
            padding: 14px;
            border-radius: 16px;
          }

          .lessonStrip {
            grid-template-columns: repeat(5, minmax(58px, 1fr));
            overflow-x: auto;
          }

          .cardFooter {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .toolbar {
            grid-template-columns: 1fr;
          }

          .toolbar > * {
            grid-column: 1;
          }

          .mainDetails {
            grid-template-columns: 1fr 1fr;
          }

          .dateRow {
            grid-template-columns: 1fr 1fr;
          }

          .cardHeader h3 {
            font-size: 17px;
          }
        }
      `}</style>
    </div>
  );
}
