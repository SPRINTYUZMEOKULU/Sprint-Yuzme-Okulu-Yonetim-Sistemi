"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

import {
  bulkTransferStudents,
  prepareBulkStudentMessage,
} from "./bulk-actions";

export type StudentListItem = {
  id: string;
  student_number?: string | null;
  birth_date?: string | null;
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
  normal_remaining_lessons?: number | null;
  total_remaining_lessons?: number | null;
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

  latest_note_id?: string | null;
  latest_note_body?: string | null;
  latest_note_type?: string | null;
  latest_note_created_at?: string | null;
  note_count?: number | null;
  active_note_reminder_at?: string | null;
  active_note_reminder_id?: string | null;
  active_note_reminder_note_body?: string | null;

  schedule_text?: string | null;
  schedule_weekdays?: number[];
  schedule_slots?: Array<{
    id: string;
    weekday: number;
    start_time?: string | null;
    end_time?: string | null;
  }>;

  created_at?: string | null;
};

export type BranchOption = {
  id: string;
  name: string;
};

export type GroupOption = {
  id: string;
  branch_id: string | null;
  name: string;
  course_type: string | null;
};

export type ScheduleOption = {
  id: string;
  group_id: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
};

type StudentNoteItem = {
  id: string;
  note_type?: string | null;
  body: string;
  created_at?: string | null;
  reminder_at?: string | null;
  reminder_completed?: boolean;
};

type Props = {
  students: StudentListItem[];
  branches?: BranchOption[];
  groups?: GroupOption[];
  schedules?: ScheduleOption[];
};

type StatusFilter =
  | "all"
  | "active"
  | "starting"
  | "passive"
  | "pre_registration"
  | "ending_soon"
  | "information_pending"
  | "lesson_ended"
  | "payment_waiting"
  | "compensation_waiting";

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
  | "pool_closed"
  | "hygiene"
  | "technical"
  | "group_transfer"
  | "time_change"
  | "coach_change"
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

const DAY_NAMES: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

function shortTime(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function scheduleLabel(student: StudentListItem) {
  if (student.schedule_slots?.length) {
    return student.schedule_slots
      .map(
        (slot) =>
          `${DAY_NAMES[slot.weekday] || "Ders"} ${shortTime(
            slot.start_time
          )}-${shortTime(slot.end_time)}`
      )
      .join(" • ");
  }

  return (student.schedule_text || "")
    .replaceAll("•", "")
    .replaceAll("\n", " • ")
    .trim();
}

function openWhatsAppMessage(phone: string | null, message: string) {
  if (!phone) return;

  const normalized = whatsappPhone(phone);

  if (!normalized) return;

  window.open(
    `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function openBulkWhatsAppMessages(
  messages: Array<{
    recipient: string | null;
    message: string;
  }>
) {
  const sendable = messages
    .map((item) => ({
      phone: item.recipient ? whatsappPhone(item.recipient) : "",
      message: item.message,
    }))
    .filter((item) => Boolean(item.phone));

  if (!sendable.length) {
    window.alert("WhatsApp gönderimi için geçerli telefon numarası bulunamadı.");
    return;
  }

  // WhatsApp Web / wa.me güvenlik gereği mesajı sessizce otomatik göndermez.
  // Tek tuşla tüm alıcı pencerelerini hazırlamaya çalışıyoruz.
  // Tarayıcı çoklu pencere açmayı engellerse kullanıcı pop-up izni vermelidir.
  const opened: Window[] = [];

  for (const item of sendable) {
    const popup = window.open("about:blank", "_blank");

    if (!popup) {
      break;
    }

    opened.push(popup);

    popup.opener = null;
    popup.location.href =
      `https://wa.me/${item.phone}?text=${encodeURIComponent(item.message)}`;
  }

  if (opened.length < sendable.length) {
    window.alert(
      `${opened.length}/${sendable.length} WhatsApp penceresi hazırlandı. ` +
        `Tarayıcı kalan pencereleri engelledi. Bu site için açılır pencere izni verirseniz tek tuşla tüm alıcıları hazırlayabilirsiniz.`
    );
  }
}


type IconName =
  | "home"
  | "plus"
  | "message"
  | "transfer"
  | "phone"
  | "file"
  | "calendar"
  | "archive"
  | "trash"
  | "print"
  | "edit"
  | "wallet"
  | "more";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/></>,
    transfer: <><path d="M7 7h12"/><path d="m16 4 3 3-3 3"/><path d="M17 17H5"/><path d="m8 14-3 3 3 3"/></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.74a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"/>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></>,
    archive: <><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></>,
    print: <><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></>,
    wallet: <><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6"/><path d="M16 13h4"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function escapePrintText(value?: string | null) {
  return (value || "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printStudentCard(student: StudentListItem) {
  const popup = window.open("", "_blank", "width=920,height=1100");
  if (!popup) {
    window.alert("Çıktı penceresi tarayıcı tarafından engellendi. Açılır pencere izni verip tekrar deneyin.");
    return;
  }

  const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
  const phone = student.guardian_phone || student.phone || "—";
  const schedule = scheduleLabel(student) || "—";
  const remaining = student.total_remaining_lessons ?? student.remaining_lessons ?? 0;

  popup.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"/><title>${escapePrintText(fullName)} - Kursiyer Bilgi Kartı</title><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#10233f;background:#fff}.sheet{width:100%;max-width:186mm;margin:0 auto}.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:3px solid #1268d6;padding-bottom:14px}.brand{font-size:22px;font-weight:900;color:#1268d6}.sub{font-size:11px;letter-spacing:.12em;color:#64748b;margin-top:4px}.status{border:1px solid #d7e5f7;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800}.name{font-size:28px;margin:22px 0 5px}.number{color:#64748b;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.box{border:1px solid #dce5ef;border-radius:10px;padding:11px 12px;min-height:62px}.box span{display:block;font-size:9px;font-weight:800;letter-spacing:.08em;color:#7b8ca3;text-transform:uppercase;margin-bottom:6px}.box strong{font-size:13px;line-height:1.35}.wide{grid-column:1/-1}.rights{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.rights .box{text-align:center}.rights strong{font-size:20px}.foot{margin-top:22px;padding-top:10px;border-top:1px solid #dce5ef;display:flex;justify-content:space-between;font-size:10px;color:#64748b}.sign{margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:44px}.sign div{border-top:1px solid #94a3b8;padding-top:7px;text-align:center;font-size:10px;color:#64748b}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.sheet{max-width:none}}
  </style></head><body><main class="sheet"><div class="head"><div><div class="brand">SPRİNT YÜZME OKULU</div><div class="sub">KURSİYER BİLGİ KARTI · SPRİNTOS</div></div><div class="status">${escapePrintText(statusLabels[student.status || ""] || student.status || "Kayıt")}</div></div><h1 class="name">${escapePrintText(fullName)}</h1><div class="number">Öğrenci No: ${escapePrintText(student.student_number)} · Yaş: ${escapePrintText(ageLabel(student.birth_date))}</div><section class="grid"><div class="box"><span>Şube / Havuz</span><strong>${escapePrintText(student.branch_name)}</strong></div><div class="box"><span>Grup</span><strong>${escapePrintText(student.group_name)}</strong></div><div class="box wide"><span>Ders Programı</span><strong>${escapePrintText(schedule)}</strong></div><div class="box"><span>Paket</span><strong>${escapePrintText(student.package_name)}</strong></div><div class="box"><span>Seviye</span><strong>${escapePrintText(student.swimming_level)}</strong></div><div class="box"><span>Başlangıç</span><strong>${escapePrintText(formatDate(student.start_date))}</strong></div><div class="box"><span>Bitiş</span><strong>${escapePrintText(formatDate(student.compensation_end_date || student.normal_end_date || student.end_date))}</strong></div><div class="box wide"><span>İletişim / Veli</span><strong>${escapePrintText(student.guardian_name)} · ${escapePrintText(phone)}</strong></div></section><section class="rights"><div class="box"><span>Paket Ders</span><strong>${student.package_lesson_count ?? 0}</strong></div><div class="box"><span>Kullanılan</span><strong>${student.used_lessons ?? 0}</strong></div><div class="box"><span>Normal Kalan</span><strong>${student.normal_remaining_lessons ?? 0}</strong></div><div class="box"><span>Toplam Hak</span><strong>${remaining}</strong></div></section><div class="sign"><div>Yönetici / Yetkili</div><div>Veli / Kursiyer</div></div><div class="foot"><span>SprintOS üzerinden oluşturulmuştur.</span><span>${new Date().toLocaleString("tr-TR")}</span></div></main><script>window.onload=()=>{window.print();}</script></body></html>`);
  popup.document.close();
}

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

function ageFromBirthDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!birthdayPassed) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function ageLabel(value?: string | null) {
  const age = ageFromBirthDate(value);
  return age == null ? "Yaş bilgisi yok" : `${age} yaş`;
}

function matchesAgeGroup(value: string, birthDate?: string | null) {
  if (value === "all") return true;
  const age = ageFromBirthDate(birthDate);
  if (age == null) return false;
  if (value === "3_5") return age >= 3 && age <= 5;
  if (value === "6_8") return age >= 6 && age <= 8;
  if (value === "9_11") return age >= 9 && age <= 11;
  if (value === "12_13") return age >= 12 && age <= 13;
  if (value === "14_plus") return age >= 14;
  return true;
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

  if (outstanding > 0) {
    return {
      text: "Ödeme Bekleniyor",
      className: "paymentWarn",
    };
  }

  return {
    text: "Borç Yok",
    className: "paymentOk",
  };
}

function informationNeed(student: StudentListItem) {
  if (student.status !== "active") return null;

  const outstanding = numberValue(student.payment_outstanding);
  const remaining = numberValue(student.remaining_lessons);
  const plannedCompensation = numberValue(
    student.planned_compensation_lessons
  );

  if (outstanding > 0) {
    return {
      type: "payment" as MessageType,
      level: "important",
      title: "Ödeme Bilgilendirmesi Bekliyor",
      detail: "Aktif kayıtta ödeme bakiyesi bulunuyor.",
    };
  }

  if (
    remaining <= 3 ||
    isEndingSoon(
      student.compensation_end_date ||
        student.normal_end_date ||
        student.end_date
    )
  ) {
    return {
      type: "renewal" as MessageType,
      level: "important",
      title: "Kayıt Yenileme Bilgilendirmesi",
      detail: `${Math.max(remaining, 0)} ders hakkı kaldı.`,
    };
  }

  if (plannedCompensation > 0 || student.next_compensation_date) {
    return {
      type: "compensation" as MessageType,
      level: "normal",
      title: "Telafi Bilgilendirmesi Bekliyor",
      detail: student.next_compensation_date
        ? `Planlanan telafi: ${formatDate(student.next_compensation_date)}`
        : "Planlanmış telafi dersi bulunuyor.",
    };
  }

  if (student.last_absent_date) {
    const absent = new Date(student.last_absent_date);
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - absent.getTime()) / 86400000
    );

    if (!Number.isNaN(diff) && diff >= 0 && diff <= 7) {
      return {
        type: "absence" as MessageType,
        level: "normal",
        title: "Devamsızlık Bilgilendirmesi",
        detail: `Son gelmedi kaydı: ${formatDate(student.last_absent_date)}`,
      };
    }
  }

  return null;
}

function buildMessage(
  student: StudentListItem,
  type: MessageType
) {
  const adult = isAdultCourse(student.course_type);
  const name = `${student.first_name} ${student.last_name}`.trim();

  const normalRemaining =
    student.normal_remaining_lessons != null
      ? numberValue(student.normal_remaining_lessons)
      : Math.max(
          numberValue(student.package_lesson_count) -
            numberValue(student.used_lessons),
          0
        );

  const compensationRemaining =
    numberValue(student.compensation_lessons);

  const totalRemaining =
    student.total_remaining_lessons != null
      ? numberValue(student.total_remaining_lessons)
      : normalRemaining + compensationRemaining;

  const endDate =
    student.compensation_end_date ||
    student.normal_end_date ||
    student.end_date;

  const endText = formatDate(endDate);
  const startText = formatDate(student.start_date);
  const outstanding = numberValue(student.payment_outstanding);

  const compensationDate = formatDate(
    student.next_compensation_date
  );

  const compensationTime = [
    student.next_compensation_start_time?.slice(0, 5),
    student.next_compensation_end_time?.slice(0, 5),
  ]
    .filter(Boolean)
    .join("–");

  const compensationGroup =
    student.next_compensation_group ||
    student.group_name ||
    "—";

  const lastAbsent = formatDate(student.last_absent_date);
  const scheduleText =
    student.schedule_text || "• Program bilgisi bulunamadı";

  const branchText = student.branch_name || "—";
  const groupText = student.group_name || "—";

  const packageText =
    student.package_name ||
    (numberValue(student.package_lesson_count) > 0
      ? `${numberValue(student.package_lesson_count)} Ders`
      : "—");

  const contactUrl =
    "https://sprintyuzmekursu.com/iletisim/";

  const infoPhone = "+90 (551) 896 83 19";

  const header = `*SPRİNT YÜZME OKULU*`;

  const greeting = adult
    ? `Değerli Kursiyerimiz, *${name}*`
    : `Değerli Velimiz,\n*${name}* isimli öğrencimiz`;

  const footer =
    `\n\n☎️ *SPRİNT BİLGİLENDİRME HATTI*\n` +
    `${infoPhone}\n\n` +
    `_Bilginize sunar, iyi günler dileriz._\n` +
    `*SPRİNT YÜZME OKULU*`;

  const locationBlock =
    `📍 *KONUM VE ADRES BİLGİLERİ*\n` +
    `Şubenizin adres ve konum bilgilerine aşağıdaki bağlantıdan ulaşabilirsiniz:\n` +
    `${contactUrl}`;

  const equipmentBlock =
    `🎒 *KURSA GELİRKEN GETİRİLMESİ GEREKENLER*\n` +
    `• Mayo / yüzme şortu\n` +
    `• Havlu\n` +
    `• Terlik\n` +
    `• Havuz gözlüğü\n\n` +
    `🎁 *SPRİNT BONESİ HEDİYEMİZDİR*\n` +
    `Sprint bonesi yüzme okulumuzun hediyesidir. Kursumuza ilk katılım sırasında kursiyerimize teslim edilecektir.\n\n` +
    `🥽 *HAVUZ GÖZLÜĞÜ*\n` +
    `Havuz gözlüğünüz yoksa dilerseniz yüzme okulumuzdan satın alabilirsiniz.\n\n` +
    `⏰ *TESİSE GELİŞ*\n` +
    `Ders başlangıç saatinden *en az 15 dakika önce* tesiste hazır bulunmanızı rica ederiz.`;

  if (type === "smart") {
    if (totalRemaining <= 0) {
      return buildMessage(student, "lesson_finished");
    }

    if (outstanding > 0) {
      return buildMessage(student, "payment");
    }

    if (student.next_compensation_date) {
      return buildMessage(student, "compensation");
    }

    if (student.last_absent_date) {
      return buildMessage(student, "absence");
    }

    if (normalRemaining <= 3 || isEndingSoon(endDate)) {
      return buildMessage(student, "renewal");
    }

    return buildMessage(student, "registration");
  }

  if (type === "registration") {
    return (
      `${header}\n\n` +
      `_*KAYDINIZ YAPILMIŞTIR*_\n\n` +
      `${greeting}\n\n` +
      `${
        adult
          ? "Yüzme kursu kaydınız başarıyla oluşturulmuştur."
          : "yüzme kursu kaydı başarıyla oluşturulmuştur."
      }\n\n` +
      `🏊 *KURS BİLGİLERİ*\n` +
      `💳 *Paket:* ${packageText}\n` +
      `🏢 *Şube:* ${branchText}\n` +
      `👥 *Grup:* ${groupText}\n\n` +
      `📅 *DERS GÜN VE SAATLERİ*\n` +
      `${scheduleText}\n\n` +
      `📆 *Başlangıç Tarihi:* ${startText}\n` +
      `📆 *Planlanan Bitiş Tarihi:* ${endText}\n\n` +
      `${equipmentBlock}\n\n` +
      `${locationBlock}` +
      footer
    );
  }

  if (type === "renewal") {
    return (
      `${header}\n\n` +
      `_*KAYIT YENİLEME HATIRLATMASI*_\n\n` +
      `${greeting}\n\n` +
      `${
        adult
          ? "kayıt yenileme döneminiz yaklaşmaktadır."
          : "için kayıt yenileme dönemi yaklaşmaktadır."
      }\n\n` +
      `📅 *Planlanan Bitiş:* ${endText}\n` +
      `🏊 *Normal Kalan Ders:* ${normalRemaining}\n` +
      `➕ *Telafi Kalan:* ${compensationRemaining}\n` +
      `✅ *Toplam Kalan:* ${totalRemaining}\n\n` +
      `Ders planlamasının aksamaması için kayıt yenileme işleminizi zamanında tamamlamanızı rica ederiz.` +
      footer
    );
  }

  if (type === "freeze") {
    return (
      `${header}\n\n` +
      `_*KAYIT DONDURMA BİLGİLENDİRMESİ*_\n\n` +
      `${greeting}\n\n` +
      `${
        adult
          ? "kayıt dondurma işleminiz sistemimize işlenmiştir."
          : "için kayıt dondurma işlemi sistemimize işlenmiştir."
      }\n\n` +
      `📅 *Mevcut Planlanan Bitiş:* ${endText}\n` +
      `🏊 *Toplam Kullanılabilir Ders:* ${totalRemaining}\n\n` +
      `Güncel kayıt planınızla ilgili bilgi almak için bizimle iletişime geçebilirsiniz.` +
      footer
    );
  }

  if (type === "compensation") {
    if (!student.next_compensation_date) {
      return (
        `${header}\n\n` +
        `_*TELAFİ BİLGİLENDİRMESİ*_\n\n` +
        `${greeting}\n\n` +
        `Planlanmış aktif bir telafi dersi bulunmamaktadır.` +
        footer
      );
    }

    return (
      `${header}\n\n` +
      `_*TELAFİ DERSİ BİLGİLENDİRMESİ*_\n\n` +
      `${greeting}\n\n` +
      `${
        adult
          ? "telafi dersiniz planlanmıştır."
          : "için telafi dersi planlanmıştır."
      }\n\n` +
      `📅 *Tarih:* ${compensationDate}\n` +
      `⏰ *Saat:* ${compensationTime || "—"}\n` +
      `👥 *Grup:* ${compensationGroup}\n` +
      `➕ *Mevcut Telafi Hakkı:* ${compensationRemaining}\n\n` +
      `Belirtilen tarih ve saatte derse katılım sağlamanızı rica ederiz.` +
      footer
    );
  }

  if (type === "absence") {
    if (!student.last_absent_date) {
      return (
        `${header}\n\n` +
        `_*DEVAMSIZLIK BİLGİLENDİRMESİ*_\n\n` +
        `${greeting}\n\n` +
        `Kayıtlı bir “Gelmedi” yoklaması bulunmamaktadır.` +
        footer
      );
    }

    return (
      `${header}\n\n` +
      `_*DEVAMSIZLIK BİLGİLENDİRMESİ*_\n\n` +
      `${greeting}\n\n` +
      `${
        adult
          ? "aşağıdaki tarihli dersinize katılım sağlamadığınız görülmüştür."
          : "aşağıdaki tarihli derse katılım sağlamamıştır."
      }\n\n` +
      `📅 *Ders Tarihi:* ${lastAbsent}\n\n` +
      `Bu mesaj bilgilendirme amacıyla gönderilmiştir.` +
      footer
    );
  }

  if (type === "payment") {
    if (outstanding <= 0) {
      return (
        `${header}\n\n` +
        `_*ÖDEME BİLGİLENDİRMESİ*_\n\n` +
        `${greeting}\n\n` +
        `Aktif kayıt dönemine ait bekleyen ödeme görünmemektedir.` +
        footer
      );
    }

    const amount = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(outstanding);

    return (
      `${header}\n\n` +
      `_*ÖDEME HATIRLATMASI*_\n\n` +
      `${greeting}\n\n` +
      `💳 *Aktif Paket:* ${packageText}\n` +
      `💰 *Bekleyen Ödeme:* ${amount}\n\n` +
      `Aktif kayıt paketine ait yukarıdaki tutarda bekleyen ödeme bulunmaktadır. Ödeme planıyla ilgili bilgi almak için bizimle iletişime geçebilirsiniz.` +
      footer
    );
  }

  if (type === "lesson_ending") {
    return (
      `${header}\n\n` +
      `_*DERS HAKKI BİTİYOR*_\n\n` +
      `${greeting}\n\n` +
      `🏊 *Normal Kalan:* ${normalRemaining}\n` +
      `➕ *Telafi Kalan:* ${compensationRemaining}\n` +
      `✅ *Toplam Kalan:* ${totalRemaining}\n` +
      `📅 *Planlanan Bitiş:* ${endText}\n\n` +
      `Ders planlamasının kesintiye uğramaması için kayıt yenileme işleminizi planlamanızı rica ederiz.` +
      footer
    );
  }

  if (type === "lesson_finished") {
    return (
      `${header}\n\n` +
      `_*DERS HAKKI TAMAMLANDI*_\n\n` +
      `${greeting}\n\n` +
      `${
        adult
          ? "mevcut kullanılabilir ders hakkınız tamamlanmıştır."
          : "için mevcut kullanılabilir ders hakkı tamamlanmıştır."
      }\n\n` +
      `Ders takibi sona ermiştir. Kursa devam edilebilmesi için kayıt yenileme işleminin yapılması gerekmektedir.` +
      footer
    );
  }

  if (type === "program") {
    return (
      `${header}\n\n` +
      `_*DERS PROGRAMI BİLGİLENDİRMESİ*_\n\n` +
      `${greeting}\n\n` +
      `🏢 *Şube:* ${branchText}\n` +
      `👥 *Grup:* ${groupText}\n\n` +
      `📅 *DERS GÜN VE SAATLERİ*\n` +
      `${scheduleText}\n\n` +
      `⏰ Ders başlangıç saatinden *en az 15 dakika önce* tesiste hazır bulunmanızı rica ederiz.\n\n` +
      `${locationBlock}` +
      footer
    );
  }

  return (
    `${header}\n\n` +
    `_*GENEL BİLGİLENDİRME*_\n\n` +
    `${greeting}\n\n` +
    `Kurs kaydınızla ilgili bilgilendirme için iletişime geçiyoruz.` +
    footer
  );
}

function noteReminderLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function noteReminderDue(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

function noteDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function StudentsClient({
  students,
  branches: branchOptions = [],
  groups: groupOptions = [],
  schedules: scheduleOptions = [],
}: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [branch, setBranch] = useState("all");
  const [group, setGroup] = useState("all");
  const [level, setLevel] = useState("all");
  const [ageGroup, setAgeGroup] = useState("all");
  const [sort, setSort] = useState<SortType>("name_asc");
  const [dataPanelOpen, setDataPanelOpen] = useState(false);

  const [dayFilter, setDayFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [bulkMode, setBulkMode] = useState<
    "transfer" | "message" | null
  >(null);

  const [targetBranchId, setTargetBranchId] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [targetScheduleIds, setTargetScheduleIds] = useState<string[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [transferLessonCount, setTransferLessonCount] = useState("");
  const [additionalTransferLessons, setAdditionalTransferLessons] = useState("0");
  const [prepareTransferMessages, setPrepareTransferMessages] =
    useState(true);
  const [updateAttendancePlans, setUpdateAttendancePlans] =
    useState(true);
  const [logTransferHistory, setLogTransferHistory] = useState(true);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState("");

  const [bulkMessageType, setBulkMessageType] = useState<
    | "pool_closed"
    | "hygiene"
    | "technical"
    | "group_transfer"
    | "time_change"
    | "coach_change"
    | "renewal"
    | "payment"
    | "general"
  >("general");
  const [bulkMessageText, setBulkMessageText] = useState("");

  const [bulkPreparedMessages, setBulkPreparedMessages] = useState<
    Array<{
      studentId: string;
      studentName: string;
      recipient: string | null;
      message: string;
    }>
  >([]);

  const [bulkWhatsappOpening, setBulkWhatsappOpening] = useState(false);
  const [selectedWhatsappStudentIds, setSelectedWhatsappStudentIds] = useState<string[]>([]);
  const [whatsappQueueCursor, setWhatsappQueueCursor] = useState(0);
  const [openedWhatsappStudentIds, setOpenedWhatsappStudentIds] = useState<string[]>([]);

 
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

const [noteStudent, setNoteStudent] = useState<StudentListItem | null>(null);
const [noteItems, setNoteItems] = useState<StudentNoteItem[]>([]);
const [noteLoading, setNoteLoading] = useState(false);
const [noteSaving, setNoteSaving] = useState(false);
const [noteError, setNoteError] = useState("");
const [noteBody, setNoteBody] = useState("");
const [noteType, setNoteType] = useState("general");
const [noteReminderAt, setNoteReminderAt] = useState("");
const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

async function loadStudentNotes(studentId: string) {
  setNoteLoading(true);
  setNoteError("");
  try {
    const response = await fetch(`/api/student-notes?studentId=${encodeURIComponent(studentId)}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Notlar yüklenemedi.");
    setNoteItems((result.notes || []) as StudentNoteItem[]);
  } catch (error) {
    setNoteError(error instanceof Error ? error.message : "Notlar yüklenemedi.");
  } finally {
    setNoteLoading(false);
  }
}

function openStudentNotes(student: StudentListItem) {
  setNoteStudent(student);
  setEditingNoteId(null);
  setNoteBody("");
  setNoteType("general");
  setNoteReminderAt("");
  setNoteError("");
  void loadStudentNotes(student.id);
}

function closeStudentNotes() {
  setNoteStudent(null);
  setNoteItems([]);
  setEditingNoteId(null);
  setNoteBody("");
  setNoteType("general");
  setNoteReminderAt("");
  setNoteError("");
}

function editStudentNote(note: StudentNoteItem) {
  setEditingNoteId(note.id);
  setNoteBody(note.body || "");
  setNoteType(note.note_type || "general");
  setNoteReminderAt(noteDateTimeLocal(note.reminder_at));
  setNoteError("");
}

function resetStudentNoteForm() {
  setEditingNoteId(null);
  setNoteBody("");
  setNoteType("general");
  setNoteReminderAt("");
  setNoteError("");
}

async function saveStudentNote() {
  if (!noteStudent || !noteBody.trim() || noteSaving) return;
  setNoteSaving(true);
  setNoteError("");
  try {
    const response = await fetch("/api/student-notes", {
      method: editingNoteId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingNoteId,
        student_id: noteStudent.id,
        body: noteBody.trim(),
        note_type: noteType,
        reminder_at: noteReminderAt || null,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Not kaydedilemedi.");
    await loadStudentNotes(noteStudent.id);
    resetStudentNoteForm();
    router.refresh();
  } catch (error) {
    setNoteError(error instanceof Error ? error.message : "Not kaydedilemedi.");
  } finally {
    setNoteSaving(false);
  }
}

async function deleteStudentNote(noteId: string) {
  if (!noteStudent || noteSaving) return;
  if (!window.confirm("Bu not ve bağlı hatırlatma kalıcı olarak silinsin mi?")) return;
  setNoteSaving(true);
  setNoteError("");
  try {
    const response = await fetch("/api/student-notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: noteId, student_id: noteStudent.id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Not silinemedi.");
    await loadStudentNotes(noteStudent.id);
    if (editingNoteId === noteId) resetStudentNoteForm();
    router.refresh();
  } catch (error) {
    setNoteError(error instanceof Error ? error.message : "Not silinemedi.");
  } finally {
    setNoteSaving(false);
  }
}

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

  const availableDays = useMemo(() => {
    return Array.from(
      new Set(
        students.flatMap((student) =>
          student.schedule_weekdays || []
        )
      )
    )
      .filter((day) => day >= 1 && day <= 7)
      .sort((a, b) => a - b);
  }, [students]);

  const availableTimes = useMemo(() => {
    const rows = students
      .filter((student) => {
        if (dayFilter === "all") return true;
        return (student.schedule_weekdays || []).includes(
          Number(dayFilter)
        );
      })
      .flatMap((student) => student.schedule_slots || [])
      .filter((slot) => {
        if (dayFilter === "all") return true;
        return slot.weekday === Number(dayFilter);
      })
      .map(
        (slot) =>
          `${shortTime(slot.start_time)}-${shortTime(slot.end_time)}`
      )
      .filter(Boolean);

    return Array.from(new Set(rows)).sort();
  }, [students, dayFilter]);

  const targetGroups = useMemo(
    () =>
      groupOptions.filter(
        (item) =>
          !targetBranchId || item.branch_id === targetBranchId
      ),
    [groupOptions, targetBranchId]
  );

  const targetSchedules = useMemo(
    () =>
      scheduleOptions
        .filter(
          (item) =>
            item.group_id === targetGroupId &&
            item.weekday != null
        )
        .sort((a, b) => {
          const dayDiff =
            Number(a.weekday || 0) - Number(b.weekday || 0);
          if (dayDiff !== 0) return dayDiff;
          return String(a.start_time || "").localeCompare(
            String(b.start_time || "")
          );
        }),
    [scheduleOptions, targetGroupId]
  );

  const selectedStudents = useMemo(
    () =>
      students.filter((student) =>
        selectedStudentIds.includes(student.id)
      ),
    [students, selectedStudentIds]
  );

  // Başlangıç tarihi gelmemiş aktif kayıtlar Başlayacak listesinde tutulur.
  const isStartingStudent = (student: StudentListItem) => {
    if (student.status !== "active" || !student.start_date) return false;
    const start = new Date(student.start_date);
    if (Number.isNaN(start.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    return start.getTime() > today.getTime();
  };

  const counts = useMemo(() => {
    return {
      total: students.length,
      active: students.filter((student) => student.status === "active").length,
      starting: students.filter(isStartingStudent).length,
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
          student.status === "active" &&
          (
            numberValue(student.planned_compensation_lessons) > 0 ||
            numberValue(student.compensation_lessons) > 0 ||
            Boolean(student.next_compensation_date)
          )
      ).length,
      informationPending: students.filter(
        (student) => Boolean(informationNeed(student))
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

      const ageMatch = matchesAgeGroup(ageGroup, student.birth_date);

      const dayMatch =
        dayFilter === "all" ||
        (student.schedule_weekdays || []).includes(
          Number(dayFilter)
        );

      const timeMatch =
        timeFilter === "all" ||
        (student.schedule_slots || []).some(
          (slot) =>
            `${shortTime(slot.start_time)}-${shortTime(
              slot.end_time
            )}` === timeFilter &&
            (dayFilter === "all" ||
              slot.weekday === Number(dayFilter))
        );

      let statusMatch = true;

      if (status === "active") {
        // Aktif statüdeki tüm kesin kayıtlar Aktif listede görünür.
        // Başlangıç tarihi ileri bir tarih olsa bile kayıt aktifse gizlenmez;
        // "Başlayacak" sekmesi aynı öğrenciyi operasyonel takip için ayrıca gösterebilir.
        statusMatch = student.status === "active";
      }

      if (status === "starting") {
        statusMatch = isStartingStudent(student);
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

      if (status === "information_pending") {
        statusMatch = Boolean(informationNeed(student));
      }

      if (status === "lesson_ended") {
        statusMatch = numberValue(student.total_remaining_lessons ?? student.remaining_lessons) <= 0;
      }

      if (status === "payment_waiting") {
        statusMatch = numberValue(student.payment_outstanding) > 0;
      }

      if (status === "compensation_waiting") {
        statusMatch =
          student.status === "active" &&
          (
            numberValue(student.planned_compensation_lessons) > 0 ||
            numberValue(student.compensation_lessons) > 0 ||
            Boolean(student.next_compensation_date)
          );
      }

      return (
        searchMatch &&
        branchMatch &&
        groupMatch &&
        levelMatch &&
        ageMatch &&
        dayMatch &&
        timeMatch &&
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
  }, [
    students,
    search,
    status,
    branch,
    group,
    level,
    ageGroup,
    dayFilter,
    timeFilter,
    sort,
  ]);


  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  }

  function selectAllFiltered() {
    const ids = filteredStudents.map((student) => student.id);

    setSelectedStudentIds((current) => {
      const allSelected =
        ids.length > 0 && ids.every((id) => current.includes(id));

      if (allSelected) {
        return current.filter((id) => !ids.includes(id));
      }

      return Array.from(new Set([...current, ...ids]));
    });
  }

  function clearSelection() {
    setSelectedStudentIds([]);
    setBulkMode(null);
    setBulkResult("");
  }

  function openBulkTransfer() {
    if (!selectedStudentIds.length) return;
    setBulkMode("transfer");
    setBulkResult("");
  }

  function openBulkMessage() {
    if (!selectedStudentIds.length) return;
    setBulkMode("message");
    setBulkResult("");
    if (!bulkMessageText.trim()) {
      setBulkMessageText(buildBulkTemplate(bulkMessageType));
    }
  }

  function closeBulkPanel() {
    setBulkMode(null);
    setBulkResult("");
  }

  async function submitBulkTransfer() {
    if (
      !selectedStudentIds.length ||
      !targetBranchId ||
      !targetGroupId ||
      !targetScheduleIds.length ||
      !effectiveDate
    ) {
      setBulkResult(
        "Yeni şube, grup, başlangıç tarihi ve en az bir ders seansı seçilmelidir."
      );
      return;
    }

    try {
      setBulkSubmitting(true);
      setBulkResult("");

      const result = await bulkTransferStudents({
        studentIds: selectedStudentIds,
        targetBranchId,
        targetGroupId,
        targetScheduleIds,
        effectiveDate,
        transferLessonCount: transferLessonCount ? Number(transferLessonCount) : null,
        additionalLessons: Number(additionalTransferLessons || 0),
        prepareMessages: prepareTransferMessages,
        updateAttendancePlans,
        logHistory: logTransferHistory,
      });

      setBulkResult(result.message);

      if (result.transferredCount && result.transferredCount > 0) {
        setSelectedStudentIds([]);
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setBulkResult("Toplu aktarım sırasında bağlantı hatası oluştu.");
    } finally {
      setBulkSubmitting(false);
    }
  }

  function buildBulkTemplate(
    type: typeof bulkMessageType
  ) {
    const selectedCount = selectedStudentIds.length;

    const commonBranch = Array.from(
      new Set(
        selectedStudents
          .map((student) => student.branch_name)
          .filter(Boolean)
      )
    );

    const commonGroup = Array.from(
      new Set(
        selectedStudents
          .map((student) => student.group_name)
          .filter(Boolean)
      )
    );

    const commonSchedule = Array.from(
      new Set(
        selectedStudents
          .map((student) => scheduleLabel(student))
          .filter(Boolean)
      )
    );

    const branchLine =
      commonBranch.length === 1
        ? `\n🏢 *Şube:* ${commonBranch[0]}`
        : "";

    const groupLine =
      commonGroup.length === 1
        ? `\n👥 *Grup:* ${commonGroup[0]}`
        : "";

    const scheduleLine =
      commonSchedule.length === 1
        ? `\n🕒 *Program:* ${commonSchedule[0]}`
        : "";

    const header = `*SPRİNT YÜZME OKULU*\n\nSayın Velimiz,`;

    const footer =
      `\n\nBilginize sunar, anlayışınız için teşekkür ederiz.` +
      `\n\n*Sprint Yüzme Okulu Yönetimi*`;

    if (type === "pool_closed") {
      return (
        `${header}\n\n` +
        `🏊 *DERS PROGRAMI BİLGİLENDİRMESİ*\n\n` +
        `Tesis yönetimi tarafından alınan karar doğrultusunda ilgili yüzme dersimiz bugün gerçekleştirilemeyecektir.` +
        branchLine +
        groupLine +
        scheduleLine +
        `\n\nKurum kaynaklı ders iptallerinde gerekli ders hakkı / telafi planlaması yönetim tarafından kontrol edilerek ayrıca tarafınıza bildirilecektir.` +
        footer
      );
    }

    if (type === "hygiene") {
      return (
        `${header}\n\n` +
        `🧼 *HİJYEN TEDBİRİ BİLGİLENDİRMESİ*\n\n` +
        `Tesis yönetimi tarafından alınan hijyen tedbirleri kapsamında ilgili dersimiz bugün gerçekleştirilemeyecektir.` +
        branchLine +
        groupLine +
        scheduleLine +
        `\n\nBu karar yüzme okulumuzdan bağımsız olarak tesis yönetimi tarafından alınmıştır. Sonraki ders programınız planlandığı şekilde devam edecektir.` +
        footer
      );
    }

    if (type === "technical") {
      return (
        `${header}\n\n` +
        `🛠 *TEKNİK DURUM BİLGİLENDİRMESİ*\n\n` +
        `Tesiste oluşan teknik durum nedeniyle ilgili dersimiz bugün gerçekleştirilemeyecektir.` +
        branchLine +
        groupLine +
        scheduleLine +
        `\n\nProgram ve varsa ders hakkı düzenlemesi yönetim tarafından kontrol edilerek tarafınıza bildirilecektir.` +
        footer
      );
    }

    if (type === "time_change") {
      return (
        `${header}\n\n` +
        `⏰ *DERS SAATİ GÜNCELLEMESİ*\n\n` +
        `Ders programınızda saat güncellemesi yapılmıştır.` +
        branchLine +
        groupLine +
        scheduleLine +
        `\n\nYeni ders saatinize göre tesiste ders başlangıcından en az 15 dakika önce hazır bulunmanızı rica ederiz.` +
        footer
      );
    }

    if (type === "coach_change") {
      return (
        `${header}\n\n` +
        `👤 *ANTRENÖR GÖREVLENDİRME BİLGİLENDİRMESİ*\n\n` +
        `Ders programınızda antrenör görevlendirmesiyle ilgili düzenleme yapılmıştır.` +
        branchLine +
        groupLine +
        scheduleLine +
        `\n\nDers planınız aynı program doğrultusunda devam edecektir.` +
        footer
      );
    }

    if (type === "renewal") {
      return (
        `${header}\n\n` +
        `🔄 *KAYIT YENİLEME HATIRLATMASI*\n\n` +
        `Mevcut ders paketinizin yenileme süreci yaklaşmıştır.` +
        branchLine +
        groupLine +
        `\n\nDers planlamanızın kesintiye uğramaması ve mevcut grup kontenjanınızın korunabilmesi için kayıt birimimizle iletişime geçebilirsiniz.` +
        footer
      );
    }

    if (type === "payment") {
      return (
        `${header}\n\n` +
        `💳 *ÖDEME BİLGİLENDİRMESİ*\n\n` +
        `Aktif kayıt döneminizle ilgili ödeme kaydınızın kontrolü için bilgilendirme sağlıyoruz.` +
        branchLine +
        groupLine +
        `\n\nÖdeme yaptıysanız bu mesajı dikkate almayabilirsiniz. Detaylı bilgi için kayıt birimimizle iletişime geçebilirsiniz.` +
        footer
      );
    }

    if (type === "group_transfer") {
      return (
        `${header}\n\n` +
        `🔁 *GRUP / PROGRAM GÜNCELLEMESİ*\n\n` +
        `Ders programınızda grup veya seans değişikliği yapılmıştır.` +
        branchLine +
        groupLine +
        scheduleLine +
        `\n\nKalan ders haklarınız korunarak eğitiminiz yeni programınızda kaldığı yerden devam edecektir.` +
        footer
      );
    }

    return (
      `${header}\n\n` +
      `📢 *GENEL BİLGİLENDİRME*\n\n` +
      `${selectedCount} öğrencilik seçili grubumuza yönelik bilgilendirme metnini bu alandan düzenleyebilirsiniz.` +
      branchLine +
      groupLine +
      scheduleLine +
      footer
    );
  }

  async function submitBulkMessage() {
    if (!selectedStudentIds.length || !bulkMessageText.trim()) {
      setBulkResult("Mesaj metni boş olamaz.");
      return;
    }

    try {
      setBulkSubmitting(true);
      setBulkResult("");
      setBulkPreparedMessages([]);

      const result = await prepareBulkStudentMessage({
        studentIds: selectedStudentIds,
        templateKey: bulkMessageType,
        messageBody: bulkMessageText.trim(),
        subject: "Sprint Yüzme Okulu Bilgilendirmesi",
      });

      setBulkResult(result.message);

      setBulkPreparedMessages(result.preparedMessages);
      setSelectedWhatsappStudentIds(
        result.preparedMessages
          .filter((item) => Boolean(item.recipient))
          .map((item) => item.studentId)
      );
      setWhatsappQueueCursor(0);
      setOpenedWhatsappStudentIds([]);

      router.refresh();
    } catch (error) {
      console.error(error);
      setBulkResult("Mesaj hazırlanırken bağlantı hatası oluştu.");
    } finally {
      setBulkSubmitting(false);
    }
  }



  async function handleOpenAllWhatsApp() {
    if (!bulkPreparedMessages.length || bulkWhatsappOpening) return;

    const selectedMessages = bulkPreparedMessages.filter(
      (item) =>
        Boolean(item.recipient) &&
        selectedWhatsappStudentIds.includes(item.studentId)
    );

    if (!selectedMessages.length) {
      window.alert("WhatsApp gönderimi için en az bir alıcı seçin.");
      return;
    }

    const safeCursor = Math.min(whatsappQueueCursor, selectedMessages.length - 1);
    const current = selectedMessages[safeCursor];

    setBulkWhatsappOpening(true);

    try {
      openWhatsAppMessage(current.recipient, current.message);

      setOpenedWhatsappStudentIds((existing) =>
        existing.includes(current.studentId)
          ? existing
          : [...existing, current.studentId]
      );

      setWhatsappQueueCursor((cursor) =>
        cursor + 1 >= selectedMessages.length ? 0 : cursor + 1
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setBulkWhatsappOpening(false);
    }
  }

  function toggleWhatsappRecipient(studentId: string) {
    setSelectedWhatsappStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  }

  function selectAllWhatsappRecipients() {
    setSelectedWhatsappStudentIds(
      bulkPreparedMessages
        .filter((item) => Boolean(item.recipient))
        .map((item) => item.studentId)
    );
  }

  function clearWhatsappRecipients() {
    setSelectedWhatsappStudentIds([]);
  }

  function openInformationForStudent(student: StudentListItem) {
    const need = informationNeed(student);

    setMessageStudent(student);

    if (need) {
      setMessageType(need.type);
      setMessageText(buildMessage(student, need.type));
    } else {
      setMessageType("smart");
      setMessageText(buildMessage(student, "smart"));
    }
  }

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

  function exportStudents() {
    if (!selectedStudentIds.length) return filteredStudents;
    const selected = new Set(selectedStudentIds);
    return filteredStudents.filter((student) => selected.has(student.id));
  }

  function exportCSV() {
    const studentsToExport = exportStudents();
    if (!studentsToExport.length) {
      setImportResult("Excel için öğrenci bulunamadı.");
      return;
    }

    const rows = studentsToExport.map((student, index) => {
      const normalLessons = numberValue(student.package_lesson_count);
      const compensation = numberValue(student.compensation_lessons);
      const totalRights = normalLessons + compensation;
      const remaining =
        student.total_remaining_lessons != null
          ? numberValue(student.total_remaining_lessons)
          : numberValue(student.remaining_lessons);

      return {
        "Sıra": index + 1,
        "SPR Öğrenci No": student.student_number || "",
        "Ad Soyad": `${student.first_name} ${student.last_name}`.trim(),
        "Yaş": ageFromBirthDate(student.birth_date) ?? "",
        "Doğum Tarihi": formatDate(student.birth_date),
        "Durum": statusLabels[student.status || ""] || student.status || "",
        "Şube": student.branch_name || "",
        "Grup": student.group_name || "",
        "Program": scheduleLabel(student) || "",
        "Seviye": student.swimming_level || "",
        "Paket": student.package_name || "",
        "Normal Ders": normalLessons,
        "Telafi": compensation,
        "Toplam Hak": totalRights,
        "Kullanılan": numberValue(student.used_lessons),
        "Kalan": remaining,
        "Başlangıç": formatDate(student.start_date),
        "Bitiş": formatDate(student.compensation_end_date || student.normal_end_date || student.end_date),
        "Telefon": student.phone || "",
        "Veli": student.guardian_name || "",
        "Veli Telefon": student.guardian_phone || "",
        "E-posta": student.email || student.guardian_email || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1:T1" };
    worksheet["!cols"] = [
      { wch: 7 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 24 },
      { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
      { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Öğrenciler");
    XLSX.writeFile(
      workbook,
      `SprintOS-Ogrenci-Listesi-${new Date().toISOString().slice(0, 10)}.xlsx`,
      { compression: true }
    );
    setImportResult(`${studentsToExport.length} öğrenci Excel dosyasına aktarıldı.`);
  }

  function exportPDF() {
    const rows = exportStudents();
    if (!rows.length) {
      setImportResult("PDF için öğrenci bulunamadı.");
      return;
    }
    const escape = (value: unknown) => String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const body = rows.map((student) => `<tr><td>${escape(`${student.first_name} ${student.last_name}`)}</td><td>${escape(statusLabels[student.status || ""] || student.status || "")}</td><td>${escape(student.branch_name)}</td><td>${escape(student.group_name)}</td><td>${escape(student.swimming_level)}</td><td>${escape(student.package_name)}</td><td>${numberValue(student.used_lessons)}</td><td>${numberValue(student.remaining_lessons)}</td><td>${escape(formatDate(student.end_date))}</td><td>${escape(student.phone || student.guardian_phone)}</td></tr>`).join("");
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>SprintOS Öğrenci Listesi</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#10213a;margin:0}.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #176de9;padding-bottom:10px;margin-bottom:14px}.head h1{margin:0;font-size:22px}.head p{margin:4px 0 0;color:#64748b;font-size:11px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{padding:7px 6px;border:1px solid #dbe4ef;text-align:left;vertical-align:top}th{background:#edf5ff;color:#174a7c}.foot{margin-top:10px;color:#64748b;font-size:9px;text-align:right}</style></head><body><div class="head"><div><h1>SPRİNT YÜZME OKULU</h1><p>Öğrenci listesi · ${rows.length} kayıt</p></div><strong>SprintOS</strong></div><table><thead><tr><th>Öğrenci</th><th>Durum</th><th>Şube</th><th>Grup</th><th>Seviye</th><th>Paket</th><th>Kullanılan</th><th>Kalan</th><th>Bitiş</th><th>Telefon</th></tr></thead><tbody>${body}</tbody></table><div class="foot">${escape(new Date().toLocaleString("tr-TR"))}</div><script>window.addEventListener('load',()=>window.print())<\/script></body></html>`;
    const popup = window.open("", "_blank");
    if (!popup) {
      setImportResult("PDF penceresi tarayıcı tarafından engellendi.");
      return;
    }
    try { popup.opener = null; } catch {}
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  async function importStudents(file?: File) {
    if (!file) return;
    setImportSubmitting(true);
    setImportResult("Öğrenciler kontrol ediliyor ve aktarılıyor…");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/student-import", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "İçe aktarma tamamlanamadı.");
      setImportResult(`${result.imported || 0} öğrenci Ön Kayıt durumunda aktarıldı.${result.warnings?.length ? ` ${result.warnings.length} satır için uyarı var.` : ""}`);
      router.refresh();
    } catch (error) {
      setImportResult(error instanceof Error ? error.message : "İçe aktarma sırasında hata oluştu.");
    } finally {
      setImportSubmitting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function requestBulkArchive() {
    if (!selectedStudentIds.length) return;
    const reason = window.prompt("Arşivleme gerekçesini yazın:");
    if (!reason?.trim()) return;
    if (!window.confirm(`${selectedStudentIds.length} öğrenci için yönetici onaylı arşivleme talebi oluşturulsun mu?`)) return;
    setBulkSubmitting(true);
    setBulkResult("Arşivleme talepleri oluşturuluyor…");
    const selected = students.filter((student) => selectedStudentIds.includes(student.id));
    const results = await Promise.all(selected.map(async (student) => {
      const response = await fetch("/api/student-status-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_type: "delete", student_id: student.id, branch_id: student.branch_id || null, group_id: student.group_id || null, reason: reason.trim(), description: "Toplu işlem merkezinden oluşturuldu.", old_status: student.status || "active", new_status: "deleted" }),
      });
      return response.ok;
    }));
    const completed = results.filter(Boolean).length;
    setBulkResult(`${completed}/${selected.length} arşivleme talebi yönetici onayına gönderildi.`);
    setBulkSubmitting(false);
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
      <section className="studentCommandHeader mobileProfessionalHeader">
        <div>
          <span className="commandEyebrow">SPRİNTOS · ÖĞRENCİ YÖNETİMİ</span>
          <h2>Öğrenci Merkezi</h2>
          <p>Öğrenci, iletişim, ders hakkı, telafi, kayıt yenileme ve ödeme takibini tek merkezden yönetin.</p>
        </div>

        <div className="commandActions professionalQuickActions">
          <button type="button" className="commandButton ghost" onClick={() => router.push("/")}>
            <Icon name="home" /> Ana Sayfa
          </button>
          <button type="button" className="commandButton primaryAction" onClick={() => router.push("/on-kayit")}>
            <Icon name="plus" /> Yeni Kayıt
          </button>
          <button type="button" className="commandButton orange" onClick={openBulkMessage} disabled={!selectedStudentIds.length}>
            <Icon name="message" /> Mesaj Merkezi
          </button>
          <button type="button" className="commandButton" onClick={openBulkTransfer} disabled={!selectedStudentIds.length}>
            <Icon name="transfer" /> Toplu İşlem
          </button>
        </div>
      </section>

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
          type="button"
          className={`summaryCard startingSummaryCard ${status === "starting" ? "selected" : ""}`}
          onClick={() => setStatus("starting")}
        >
          <span>Başlayacak Kursiyerler</span>
          <strong>{counts.starting}</strong>
          <small>Başlangıç tarihi yaklaşan aktif kayıtlar</small>
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
          type="button"
          className={`summaryCard passiveSummaryCard ${
            status === "passive" ? "selected" : ""
          }`}
          onClick={() => setStatus("passive")}
          title="Pasif öğrencileri görüntüle"
        >
          <span>Pasif Öğrenci</span>
          <strong>{counts.passive}</strong>
          <small>Görüntülemek için tıklayın</small>
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

        <button type="button" className={`summaryCard alertCard ${status === "lesson_ended" ? "selected" : ""}`} onClick={() => setStatus("lesson_ended")}>
          <span>Ders Hakkı Biten</span>
          <strong>{counts.lessonEnded}</strong>
          <small>Listeyi aç</small>
        </button>

        <button
          type="button"
          className={`summaryCard informationSummary ${
            status === "information_pending" ? "selected" : ""
          }`}
          onClick={() => setStatus("information_pending")}
        >
          <span>Bilgilendirme Bekliyor</span>
          <strong>{counts.informationPending}</strong>
          <small>İşlem için tıklayın</small>
        </button>

        <button type="button" className={`summaryCard warningCard ${status === "payment_waiting" ? "selected" : ""}`} onClick={() => setStatus("payment_waiting")}>
          <span>Ödeme Bekleyen</span>
          <strong>{counts.paymentWaiting}</strong>
          <small>Listeyi aç</small>
        </button>

        <button type="button" className={`summaryCard infoCard ${status === "compensation_waiting" ? "selected" : ""}`} onClick={() => { setStatus("compensation_waiting"); window.location.href = "/telafi-yonetimi"; }}>
          <span>Telafi Bekleyen</span>
          <strong>{counts.compensationWaiting}</strong>
          <small>Telafileri yönet</small>
        </button>
      </section>

      <nav className="studentStatusTabs" aria-label="Öğrenci durum filtreleri">
        <button className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>Tümü <b>{status === "all" ? filteredStudents.length : counts.total}</b></button>
        <button className={status === "active" ? "active" : ""} onClick={() => setStatus("active")}>Aktif <b>{status === "active" ? filteredStudents.length : counts.active}</b></button>
        <button className={status === "starting" ? "active" : ""} onClick={() => setStatus("starting")}>Başlayacak <b>{status === "starting" ? filteredStudents.length : counts.starting}</b></button>
        <button className={status === "passive" ? "active" : ""} onClick={() => setStatus("passive")}>Pasif <b>{status === "passive" ? filteredStudents.length : counts.passive}</b></button>
        <button className={status === "pre_registration" ? "active" : ""} onClick={() => setStatus("pre_registration")}>Ön Kayıt <b>{status === "pre_registration" ? filteredStudents.length : counts.preRegistration}</b></button>
      </nav>

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
          value={ageGroup}
          onChange={(event) => setAgeGroup(event.target.value)}
          aria-label="Yaş grubu filtresi"
        >
          <option value="all">Tüm Yaş Grupları</option>
          <option value="3_5">3–5 Yaş · Minikler</option>
          <option value="6_8">6–8 Yaş · Çocuk</option>
          <option value="9_11">9–11 Yaş · Çocuk</option>
          <option value="12_13">12–13 Yaş · Genç</option>
          <option value="14_plus">14+ · Yetişkin</option>
        </select>

        <select
          value={dayFilter}
          onChange={(event) => {
            setDayFilter(event.target.value);
            setTimeFilter("all");
          }}
        >
          <option value="all">Tüm Günler</option>
          {availableDays.map((day) => (
            <option key={day} value={String(day)}>
              {DAY_NAMES[day]}
            </option>
          ))}
        </select>

        <select
          value={timeFilter}
          onChange={(event) => setTimeFilter(event.target.value)}
        >
          <option value="all">Tüm Saatler</option>
          {availableTimes.map((time) => (
            <option key={time} value={time}>
              {time}
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

        <div className="dataPanelShell">
          <button
            type="button"
            className="dataPanelToggle"
            aria-expanded={dataPanelOpen}
            onClick={() => setDataPanelOpen((open) => !open)}
          >
            <span><Icon name="file" /> <strong>Aktarım & Çıktılar</strong></span>
            <small>Excel, PDF, şablon ve içe aktarma</small>
            <b>{dataPanelOpen ? "−" : "+"}</b>
          </button>
          {dataPanelOpen && (
            <div className="dataActions">
              <button className="dataAction primary" type="button" onClick={exportCSV}>
                <span className="dataActionIcon">XLSX</span>
                <span><strong>{selectedStudentIds.length ? "Seçilenleri Excel’e Aktar" : "Excel’e Aktar"}</strong><small>Filtrelenen listeyi düzenli çalışma kitabı olarak indir</small></span>
              </button>
              <button className="dataAction" type="button" onClick={exportPDF}>
                <span className="dataActionIcon">PDF</span>
                <span><strong>{selectedStudentIds.length ? "Seçilenleri PDF’ye Aktar" : "PDF’ye Aktar"}</strong><small>A4 yatay yazdırma / PDF ekranını aç</small></span>
              </button>
              <a className="dataAction subtle" href="/api/student-import">
                <span className="dataActionIcon">↓</span>
                <span><strong>İçe Aktarma Şablonu</strong><small>Doğru kolon yapısındaki örnek şablonu indir</small></span>
              </a>
              <button className="dataAction subtle" type="button" disabled={importSubmitting} onClick={() => importInputRef.current?.click()}>
                <span className="dataActionIcon">↑</span>
                <span><strong>{importSubmitting ? "Aktarılıyor…" : "Excel / CSV İçe Aktar"}</strong><small>Hazırladığınız dosyayı kontrol ederek sisteme aktar</small></span>
              </button>
            </div>
          )}
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(event) => void importStudents(event.target.files?.[0])}
        />
      </section>

      {importResult && <div className="resultInfo" role="status">{importResult}</div>}

      <section className="selectionToolbar">
        <label className="selectAllLabel">
          <input
            type="checkbox"
            checked={
              filteredStudents.length > 0 &&
              filteredStudents.every((student) =>
                selectedStudentIds.includes(student.id)
              )
            }
            onChange={selectAllFiltered}
          />
          <span>Görünenlerin tümünü seç</span>
        </label>

        <div>
          <strong>{selectedStudentIds.length}</strong> öğrenci seçili
        </div>

        {selectedStudentIds.length > 0 && (
          <div className="selectionActions">
            <button type="button" onClick={openBulkTransfer}>
              ⇄ Grup / Şube Aktar
            </button>
            <button type="button" onClick={openBulkMessage}>
              ✉ Toplu Mesaj
            </button>
            <button type="button" disabled={bulkSubmitting} onClick={() => void requestBulkArchive()}>
              🗃 Güvenli Arşivleme
            </button>
            <button type="button" onClick={clearSelection}>
              Seçimi Temizle
            </button>
          </div>
        )}
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

          const normalRemaining =
            student.normal_remaining_lessons != null
              ? numberValue(student.normal_remaining_lessons)
              : Math.max(normalLessons - used, 0);

          const totalRemaining =
            student.total_remaining_lessons != null
              ? numberValue(student.total_remaining_lessons)
              : normalRemaining + compensation;

          const remaining = totalRemaining;

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
              className={`studentCard ${
                selectedStudentIds.includes(student.id)
                  ? "selectedStudentCard"
                  : ""
              }`}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/ogrenciler/${student.id}`)}
              onAuxClick={(event) => {
                if (event.button === 1) window.open(`/ogrenciler/${student.id}`, "_blank", "noopener,noreferrer");
              }}
              onContextMenu={(event) => {
                if (typeof window !== "undefined" && window.matchMedia("(pointer:fine)").matches) {
                  event.preventDefault();
                  window.open(`/ogrenciler/${student.id}`, "_blank", "noopener,noreferrer");
                }
              }}
              title="Aç · Masaüstünde sağ tık veya orta tık ile yeni sekme"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  router.push(`/ogrenciler/${student.id}`);
                }
              }}
            >
              <header className="cardHeader">
                <label
                  className="studentSelect"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(student.id)}
                    onChange={() => toggleStudentSelection(student.id)}
                    aria-label={`${student.first_name} ${student.last_name} seç`}
                  />
                </label>

                <div>
                  <span className="eyebrow">
                    #{index + 1} · {student.student_number || "ÖĞRENCİ NO YOK"}
                  </span>

                  <h3>
                    {student.first_name} {student.last_name}
                  </h3>
                  <span className="studentAgeBadge" title={student.birth_date ? `Doğum tarihi: ${formatDate(student.birth_date)}` : "Doğum tarihi girilmemiş"}>
                    {ageLabel(student.birth_date)}
                  </span>
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

              <div className="studentProgramLine">
                <span>📍 {student.branch_name || "Şube yok"}</span>
                <span>👥 {student.group_name || "Grup yok"}</span>
                <strong>
                  🗓 {scheduleLabel(student) || "Program tanımlı değil"}
                </strong>
              </div>

              {informationNeed(student) && (
                <button
                  type="button"
                  className={`informationPendingBar ${
                    informationNeed(student)?.level === "important"
                      ? "important"
                      : ""
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openInformationForStudent(student);
                  }}
                >
                  <span className="infoDot">!</span>
                  <div>
                    <strong>{informationNeed(student)?.title}</strong>
                    <small>{informationNeed(student)?.detail}</small>
                  </div>
                  <b>Bilgilendir →</b>
                </button>
              )}

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

              {student.latest_note_body && (
                <button
                  type="button"
                  className={`studentNotePreview ${
                    noteReminderDue(student.active_note_reminder_at) ? "due" : ""
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openStudentNotes(student);
                  }}
                >
                  <span className="studentNoteIcon">📝</span>
                  <span className="studentNoteCopy">
                    <strong>
                      Öğrenci Notu
                      {student.note_count && student.note_count > 1
                        ? ` · ${student.note_count} not`
                        : ""}
                    </strong>
                    <small>
                      {student.active_note_reminder_at && student.active_note_reminder_note_body
                        ? student.active_note_reminder_note_body
                        : student.latest_note_body}
                    </small>
                  </span>
                  {student.active_note_reminder_at ? (
                    <span className="studentNoteReminder">
                      ⏰ {noteReminderDue(student.active_note_reminder_at) ? "Hatırlatma zamanı" : noteReminderLabel(student.active_note_reminder_at)}
                    </span>
                  ) : (
                    <span className="studentNoteReminder neutral">Aç / Düzenle</span>
                  )}
                </button>
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
                  <span>Normal Paket</span>
                  <strong>{normalLessons}</strong>
                </div>

                <div>
                  <span>Kullanılan</span>
                  <strong>{used}</strong>
                </div>

                <div>
                  <span>Normal Kalan</span>
                  <strong>{normalRemaining}</strong>
                </div>

                <div className="compensation">
                  <span>Telafi Kalan</span>
                  <strong>+{compensation}</strong>
                </div>

                <div>
                  <span>Toplam Hak</span>
                  <strong>{totalRights}</strong>
                </div>

                <div className="remaining">
                  <span>Toplam Kalan</span>
                  <strong>{totalRemaining}</strong>
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
                  <button
                    type="button"
                    className={`paymentStatusButton ${payment.className}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(`/ogrenciler/${student.id}#odeme`);
                    }}
                    aria-label={`${student.first_name} ${student.last_name} ödeme sayfasını aç`}
                  >
                    {payment.text}
                  </button>
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
      <Icon name="phone" /> Ara
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
      <Icon name="message" /> WhatsApp
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
      <Icon name="message" /> Hazır Mesaj
    </button>
    <button
      type="button"
      className="studentActionButton note"
      onClick={(event) => {
        event.stopPropagation();
        openStudentNotes(student);
      }}
    >
      📝 Not {student.note_count ? `(${student.note_count})` : ""}
    </button>

    <button
      type="button"
      className="studentActionButton"
      onClick={(event) => {
        event.stopPropagation();
        router.push(`/ogrenciler/${student.id}`);
      }}
    >
      <Icon name="file" /> Dosyayı Aç
    </button>

    <button
      type="button"
      className="studentActionButton print"
      onClick={(event) => {
        event.stopPropagation();
        printStudentCard(student);
      }}
    >
      <Icon name="print" /> A4 Çıktı
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
      <Icon name="calendar" /> Ders / Paket
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
      : <><Icon name="archive" /> Pasife Al</>}
  </button>
)}

{student.status === "passive" && (
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
      : <><Icon name="trash" /> Kalıcı Sil</>}
  </button>
)}
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
        {noteStudent && (
          <div className="noteOverlay" onClick={closeStudentNotes}>
            <aside className="notePanel" onClick={(event) => event.stopPropagation()}>
              <div className="notePanelHeader">
                <div>
                  <span>ÖĞRENCİ NOTLARI & HATIRLATMA</span>
                  <h3>{noteStudent.first_name} {noteStudent.last_name}</h3>
                  <p>Kartta görünen notlar dijital kursiyer dosyasındaki Notlar bölümüne aynı anda işlenir.</p>
                </div>
                <button type="button" onClick={closeStudentNotes} aria-label="Not penceresini kapat">×</button>
              </div>

              <div className="notePanelBody">
                <div className="noteEditor">
                  <label>
                    <span>Not Türü</span>
                    <select value={noteType} onChange={(event) => setNoteType(event.target.value)}>
                      <option value="general">Genel Not</option>
                      <option value="management">Yönetici Notu</option>
                      <option value="coach">Antrenör Notu</option>
                      <option value="registration">Kayıt Notu</option>
                      <option value="payment">Ödeme Notu</option>
                    </select>
                  </label>

                  <label className="noteTextArea">
                    <span>Not</span>
                    <textarea
                      value={noteBody}
                      onChange={(event) => setNoteBody(event.target.value)}
                      rows={4}
                      maxLength={4000}
                      placeholder="Örn. Veli ile 22 Eylül'de kayıt yenileme için tekrar görüşülecek."
                    />
                  </label>

                  <label>
                    <span>Hatırlatma</span>
                    <input
                      type="datetime-local"
                      value={noteReminderAt}
                      onChange={(event) => setNoteReminderAt(event.target.value)}
                    />
                    <small>Hatırlatma zamanı geldiğinde öğrenci kartındaki not ikazı yanıp söner.</small>
                  </label>

                  {noteError && <div className="noteError">{noteError}</div>}

                  <div className="noteEditorActions">
                    {editingNoteId && (
                      <button type="button" className="ghost" onClick={resetStudentNoteForm} disabled={noteSaving}>
                        Yeni Nota Geç
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary"
                      disabled={noteSaving || !noteBody.trim()}
                      onClick={() => void saveStudentNote()}
                    >
                      {noteSaving ? "Kaydediliyor…" : editingNoteId ? "Notu Güncelle" : "Notu Kaydet"}
                    </button>
                  </div>
                </div>

                <div className="noteHistory">
                  <div className="noteHistoryTitle">
                    <strong>Kayıtlı Notlar</strong>
                    <span>{noteItems.length}</span>
                  </div>

                  {noteLoading ? (
                    <div className="noteEmpty">Notlar yükleniyor…</div>
                  ) : noteItems.length === 0 ? (
                    <div className="noteEmpty">Henüz not eklenmemiş.</div>
                  ) : (
                    noteItems.map((note) => (
                      <article
                        key={note.id}
                        className={`noteHistoryItem ${
                          noteReminderDue(note.reminder_at) && !note.reminder_completed ? "due" : ""
                        }`}
                      >
                        <div>
                          <strong>{note.note_type === "management" ? "Yönetici Notu" : note.note_type === "coach" ? "Antrenör Notu" : note.note_type === "registration" ? "Kayıt Notu" : note.note_type === "payment" ? "Ödeme Notu" : "Genel Not"}</strong>
                          <small>{note.created_at ? new Date(note.created_at).toLocaleString("tr-TR") : ""}</small>
                        </div>
                        <p>{note.body}</p>
                        {note.reminder_at && (
                          <div className="noteReminderLine">
                            ⏰ {noteReminderDue(note.reminder_at) ? "Hatırlatma zamanı geldi" : `Hatırlatma: ${noteReminderLabel(note.reminder_at)}`}
                          </div>
                        )}
                        <div className="noteHistoryActions">
                          <button type="button" onClick={() => editStudentNote(note)}>Düzenle</button>
                          <button type="button" className="danger" onClick={() => void deleteStudentNote(note.id)}>Sil</button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {bulkMode === "transfer" && (
          <div className="bulkOverlay" onClick={closeBulkPanel}>
            <aside
              className="bulkPanel"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="bulkPanelHeader">
                <div>
                  <span>TOPLU GRUP / ŞUBE AKTARIMI</span>
                  <h3>{selectedStudents.length} öğrenci aktarılacak</h3>
                  <p>
                    Geçmiş yoklamalar korunur. Kullanılan dersler
                    değişmez; yalnız kalan haklar yeni programa taşınır.
                  </p>
                </div>
                <button type="button" onClick={closeBulkPanel}>×</button>
              </div>

              <div className="bulkPanelBody">
                <div className="bulkPreview">
                  <div>
                    <span>Mevcut Program</span>
                    <strong>
                      {selectedStudents.length === 1
                        ? `${selectedStudents[0].branch_name || "—"} · ${
                            selectedStudents[0].group_name || "—"
                          }`
                        : `${selectedStudents.length} seçili öğrenci`}
                    </strong>
                    <small>
                      {selectedStudents.length === 1
                        ? scheduleLabel(selectedStudents[0]) || "—"
                        : "Her öğrencinin mevcut programı geçmişte korunacaktır."}
                    </small>
                  </div>
                </div>

                <label>
                  <span>Yeni Şube</span>
                  <select
                    value={targetBranchId}
                    onChange={(event) => {
                      setTargetBranchId(event.target.value);
                      setTargetGroupId("");
                      setTargetScheduleIds([]);
                    }}
                  >
                    <option value="">Şube seçin</option>
                    {branchOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Yeni Grup</span>
                  <select
                    value={targetGroupId}
                    onChange={(event) => {
                      setTargetGroupId(event.target.value);
                      setTargetScheduleIds([]);
                    }}
                    disabled={!targetBranchId}
                  >
                    <option value="">Grup seçin</option>
                    {targetGroups.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="schedulePicker">
                  <span>Yeni Gün / Seans</span>
                  {!targetGroupId ? (
                    <p>Önce grup seçin.</p>
                  ) : targetSchedules.length ? (
                    targetSchedules.map((item) => {
                      const checked = targetScheduleIds.includes(item.id);
                      return (
                        <label key={item.id} className="scheduleChoice">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setTargetScheduleIds((current) =>
                                checked
                                  ? current.filter((id) => id !== item.id)
                                  : [...current, item.id]
                              )
                            }
                          />
                          <strong>
                            {DAY_NAMES[Number(item.weekday)] || "Ders"}
                          </strong>
                          <span>
                            {shortTime(item.start_time)}–
                            {shortTime(item.end_time)}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p>Bu gruba ait aktif seans bulunamadı.</p>
                  )}
                </div>

                <label>
                  <span>Aktarım Başlangıç Tarihi</span>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(event) =>
                      setEffectiveDate(event.target.value)
                    }
                  />
                </label>

                <div className="bulkInfoBox">
                  <strong>Seçilen tarihte aktarılacak ders hakkı</strong>
                  {selectedStudents.length === 1 ? (
                    <p>
                      <b>{selectedStudents[0].normal_remaining_lessons ?? selectedStudents[0].remaining_lessons ?? 0} ders</b> mevcut kalan hak görünüyor. Aktarım başlangıcı <b>{effectiveDate ? new Date(effectiveDate + "T12:00:00").toLocaleDateString("tr-TR") : "—"}</b>. Yeni program ders sayısı alanını boş bırakırsanız bu hak aynen taşınır; farklı bir sayı girerseniz yönetici tercihi olarak o sayı esas alınır.
                    </p>
                  ) : (
                    <div>
                      <p>Her öğrencinin mevcut kalan hakkı ayrı ayrı gösterilir ve aktarımda kendi kaydından çekilir.</p>
                      <div style={{maxHeight:180,overflow:"auto",display:"grid",gap:6}}>
                        {selectedStudents.map((student) => (
                          <div key={student.id} style={{display:"flex",justifyContent:"space-between",gap:12}}>
                            <span>{student.first_name} {student.last_name}</span>
                            <b>{student.normal_remaining_lessons ?? student.remaining_lessons ?? 0} ders</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="transferLessonGrid">
                  <label>
                    <span>Yeni Program Toplam Ders Sayısı</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={transferLessonCount}
                      onChange={(event) => setTransferLessonCount(event.target.value)}
                      placeholder={selectedStudents.length === 1 ? String(selectedStudents[0].normal_remaining_lessons ?? selectedStudents[0].remaining_lessons ?? "") : "Örn. 8"}
                    />
                    <small>Boş bırakırsanız mevcut kalan ders hakkı aynen taşınır.</small>
                  </label>
                  <label>
                    <span>Ek Ders</span>
                    <select value={additionalTransferLessons} onChange={(event) => setAdditionalTransferLessons(event.target.value)}>
                      <option value="0">Ek ders yok</option>
                      <option value="1">+1 ders</option>
                      <option value="2">+2 ders</option>
                    </select>
                    <small>Seçilen ek ders yeni programın bitiş hesabına dahil edilir.</small>
                  </label>
                </div>

                <div className="bulkChecks">
                  <label>
                    <input
                      type="checkbox"
                      checked={updateAttendancePlans}
                      onChange={(event) =>
                        setUpdateAttendancePlans(event.target.checked)
                      }
                    />
                    <span>Katılım planlarını güncelle</span>
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={logTransferHistory}
                      onChange={(event) =>
                        setLogTransferHistory(event.target.checked)
                      }
                    />
                    <span>Öğrenci işlem geçmişine kaydet</span>
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={prepareTransferMessages}
                      onChange={(event) =>
                        setPrepareTransferMessages(event.target.checked)
                      }
                    />
                    <span>Velilere bilgilendirme mesajı hazırla</span>
                  </label>
                </div>

                <div className="bulkInfoBox">
                  <strong>Aktarım kuralı</strong>
                  <p>
                    Geldi / Gelmedi / İzinli ile düşmüş eski dersler
                    değişmez. Kalan normal ders hakkı yeni programdan
                    itibaren devam eder. Yeni bitiş tarihi seçilen
                    günlere göre otomatik hesaplanır.
                  </p>
                </div>

                {bulkResult && (
                  <div className="bulkResult">{bulkResult}</div>
                )}
              </div>

              <div className="bulkPanelFooter">
                <button
                  type="button"
                  className="ghost"
                  onClick={closeBulkPanel}
                  disabled={bulkSubmitting}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className={`primary ${bulkSubmitting ? "isWorking" : ""}`}
                  onClick={submitBulkTransfer}
                  disabled={bulkSubmitting}
                >
                  {bulkSubmitting
                    ? "Aktarılıyor..."
                    : `✓ ${selectedStudents.length} Öğrenciyi Aktar`}
                </button>
              </div>
            </aside>
          </div>
        )}

        {bulkMode === "message" && (
          <div className="bulkOverlay" onClick={closeBulkPanel}>
            <aside
              className="bulkPanel messagePanel"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="bulkPanelHeader">
                <div>
                  <span>TOPLU MESAJ MERKEZİ</span>
                  <h3>{selectedStudents.length} öğrenci / veli</h3>
                  <p>
                    Mesajlar öğrenci dosyasındaki iletişim geçmişine
                    “hazırlandı” olarak kaydedilir.
                  </p>
                </div>
                <button type="button" onClick={closeBulkPanel}>×</button>
              </div>

              <div className="bulkPanelBody">
                <label>
                  <span>Hazır Mesaj</span>
                  <select
                    value={bulkMessageType}
                    onChange={(event) => {
                      const type = event.target.value as typeof bulkMessageType;
                      setBulkMessageType(type);
                      setBulkMessageText(buildBulkTemplate(type));
                    }}
                  >
                    <option value="general">💬 Genel Duyuru</option>
                    <option value="pool_closed">🏊 Havuz Kapalı</option>
                    <option value="hygiene">🧼 Hijyen Tedbiri</option>
                    <option value="technical">🛠 Teknik Arıza</option>
                    <option value="group_transfer">⇄ Grup Aktarımı</option>
                    <option value="time_change">⏰ Saat Değişikliği</option>
                    <option value="coach_change">👤 Antrenör Değişikliği</option>
                    <option value="renewal">🔄 Kayıt Yenileme</option>
                    <option value="payment">💳 Ödeme Hatırlatma</option>
                  </select>
                </label>

                <div className="messageModeChoice">
                  <strong>Çalışma modu</strong>
                  <div>
                    <span className="activeMode">
                      ✓ Sadece mesaj hazırla
                    </span>
                    <span>
                      Operasyon gerektiren işlemler “Toplu İşlem”
                      ekranından yapılır.
                    </span>
                  </div>
                </div>

                <label>
                  <span>Mesaj Metni</span>
                  <textarea
                    rows={14}
                    value={bulkMessageText}
                    onChange={(event) =>
                      setBulkMessageText(event.target.value)
                    }
                    placeholder="Mesaj metnini yazın..."
                  />
                </label>

                {bulkResult && (
                  <div className="bulkResult">{bulkResult}</div>
                )}

                {bulkPreparedMessages.length > 0 && (
                  <div className="whatsappQueue">
                    <div className="whatsappQueueHead">
                      <div>
                        <strong>WhatsApp Gönderim Kontrolü</strong>
                        <span>
                          Geçerli telefonu olan herkes otomatik seçilir. WhatsApp açıldığında mesaj hazır gelir; siz yalnızca Gönder'e basarsınız.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenAllWhatsApp}
                        disabled={bulkWhatsappOpening}
                        className={`sendAllWhatsapp ${
                          bulkWhatsappOpening ? "isWorking" : ""
                        }`}
                      >
                        {bulkWhatsappOpening
                          ? "● WhatsApp Açılıyor..."
                          : openedWhatsappStudentIds.length
                            ? `Sıradaki Mesajı WhatsApp’ta Aç (${openedWhatsappStudentIds.length}/${selectedWhatsappStudentIds.length}) ↗`
                            : `Gönderimi Başlat · ${selectedWhatsappStudentIds.length} Kişi ↗`}
                      </button>
                    </div>

                    <div className="whatsappQueueSummary">
                      <strong>{selectedWhatsappStudentIds.length}</strong>
                      <span>seçili</span>
                      <i>•</i>
                      <strong>
                        {
                          bulkPreparedMessages.filter((item) =>
                            Boolean(item.recipient)
                          ).length
                        }
                      </strong>
                      <span>gönderilebilir</span>
                      <i>•</i>
                      <strong>
                        {
                          bulkPreparedMessages.filter(
                            (item) => !item.recipient
                          ).length
                        }
                      </strong>
                      <span>telefon bilgisi eksik</span>

                      <div className="whatsappSelectionActions">
                        <button type="button" onClick={selectAllWhatsappRecipients}>
                          Tümünü Seç
                        </button>
                        <button type="button" onClick={clearWhatsappRecipients}>
                          Seçimi Temizle
                        </button>
                      </div>
                    </div>

                    <div className="whatsappQueueList compact">
                      {bulkPreparedMessages.map((item, index) => {
                        const isSelected = selectedWhatsappStudentIds.includes(
                          item.studentId
                        );

                        return (
                          <label
                            key={`${item.studentId}-${index}`}
                            className={`whatsappRecipientRow ${
                              isSelected ? "selected" : ""
                            } ${!item.recipient ? "disabled" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(item.recipient) && isSelected}
                              disabled={!item.recipient}
                              onChange={() => toggleWhatsappRecipient(item.studentId)}
                            />

                            <span className="whatsappCheckmark" aria-hidden="true">
                              {item.recipient && isSelected ? "✓" : ""}
                            </span>

                            <div>
                              <strong>{item.studentName}</strong>
                              <span>
                                {!item.recipient
                                  ? "Telefon bilgisi yok"
                                  : openedWhatsappStudentIds.includes(item.studentId)
                                    ? "WhatsApp'ta açıldı"
                                    : "Gönderim için seçili"}
                              </span>
                            </div>

                            <span
                              className={
                                item.recipient
                                  ? "recipientStatus ready"
                                  : "recipientStatus missing"
                              }
                            >
                              {!item.recipient
                                ? "Eksik"
                                : openedWhatsappStudentIds.includes(item.studentId)
                                  ? "Açıldı"
                                  : "Seçili"}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="whatsappLegalNote">
                      Standart WhatsApp bağlantısı birden fazla kişiyi WhatsApp içinde otomatik seçemez.
                      Bu nedenle SprintOS tüm alıcıları burada işaretli tutar; her açılışta sıradaki kişinin
                      sohbetini ve hazır mesajını getirir. WhatsApp'ta yalnızca Gönder düğmesine basarsınız.
                      Gerçek toplu otomatik gönderim için WhatsApp Business Cloud API gerekir.
                    </div>
                  </div>
                )}
              </div>

              <div className="bulkPanelFooter">
                <button
                  type="button"
                  className="ghost"
                  onClick={closeBulkPanel}
                  disabled={bulkSubmitting}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className={`primary orange ${bulkSubmitting ? "isWorking" : ""}`}
                  onClick={submitBulkMessage}
                  disabled={bulkSubmitting}
                >
                  {bulkSubmitting
                    ? "Hazırlanıyor..."
                    : `✉ ${selectedStudents.length} Mesajı Hazırla`}
                </button>
              </div>
            </aside>
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
                  <span>Normal Kalan</span>
                  <strong>
                    {numberValue(
                      messageStudent.normal_remaining_lessons ??
                        Math.max(
                          numberValue(messageStudent.package_lesson_count) -
                            numberValue(messageStudent.used_lessons),
                          0
                        )
                    )}
                  </strong>
                </div>
                <div>
                  <span>Telafi Kalan</span>
                  <strong>
                    {numberValue(messageStudent.compensation_lessons)}
                  </strong>
                </div>
                <div>
                  <span>Toplam Kalan</span>
                  <strong>
                    {numberValue(
                      messageStudent.total_remaining_lessons ??
                        messageStudent.remaining_lessons
                    )}
                  </strong>
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
                <Icon name="message" /> WhatsApp&apos;ta Aç
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
      .studentCommandHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 18px;
        padding: 22px 24px;
        border-radius: 22px;
        background:
          linear-gradient(135deg, #061f3d 0%, #0a4f8c 55%, #0b69b8 100%);
        color: #fff;
        box-shadow: 0 18px 45px rgba(15, 58, 107, 0.18);
      }

      .commandEyebrow {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .12em;
        color: #ffad2f;
      }

      .studentCommandHeader h2 {
        margin: 0;
        font-size: 24px;
        line-height: 1.2;
      }

      .studentCommandHeader p {
        margin: 6px 0 0;
        opacity: .82;
        font-size: 13px;
      }

      .commandActions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }

      .commandButton {
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 12px;
        padding: 10px 13px;
        background: rgba(255,255,255,.12);
        color: #fff;
        font-weight: 800;
        cursor: pointer;
      }

      .commandButton.orange {
        background: #ff9418;
        border-color: #ff9418;
      }

      .commandButton.ghost {
        background: rgba(255,255,255,.08);
      }

      .commandButton:disabled {
        opacity: .45;
        cursor: not-allowed;
      }

      .selectionToolbar {
        position: sticky;
        top: 8px;
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 16px;
        margin: 14px 0;
        padding: 12px 14px;
        border: 1px solid #d7e2ef;
        border-radius: 14px;
        background: rgba(255,255,255,.96);
        box-shadow: 0 10px 28px rgba(25, 57, 94, .08);
        backdrop-filter: blur(12px);
      }

      .selectAllLabel {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 800;
      }

      .selectAllLabel input,
      .studentSelect input {
        width: 18px;
        height: 18px;
        accent-color: #1268d6;
      }

      .selectionActions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-left: auto;
      }

      .selectionActions button {
        border: 1px solid #cbd9e9;
        border-radius: 10px;
        padding: 8px 11px;
        background: #fff;
        color: #12345a;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }

      .selectedStudentCard {
        border-color: #2e7bea !important;
        box-shadow: 0 0 0 2px rgba(46,123,234,.12),
          0 14px 30px rgba(27,84,150,.12) !important;
      }

      .studentSelect {
        display: grid;
        place-items: center;
        padding: 3px;
        cursor: pointer;
      }

      .studentProgramLine {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 9px;
        margin: 10px 0 12px;
        padding: 9px 11px;
        border: 1px solid #dce8f5;
        border-radius: 12px;
        background: linear-gradient(180deg,#f9fbfe,#f2f7fc);
        color: #49627f;
        font-size: 12px;
      }

      .studentProgramLine strong {
        color: #0b3d70;
      }

      .bulkOverlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        justify-content: flex-end;
        background: rgba(4, 20, 40, .58);
        backdrop-filter: blur(5px);
      }

      .bulkPanel {
        width: min(620px, 94vw);
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #f7f9fc;
        box-shadow: -24px 0 60px rgba(0,0,0,.22);
        overflow: hidden;
      }

      .bulkPanelHeader {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 24px;
        background:
          linear-gradient(135deg,#061f3d,#0a4f8c);
        color: #fff;
      }

      .bulkPanelHeader > button {
        width: 38px;
        height: 38px;
        border: 1px solid rgba(255,255,255,.25);
        border-radius: 12px;
        background: rgba(255,255,255,.1);
        color: #fff;
        font-size: 24px;
        cursor: pointer;
      }

      .bulkPanelHeader span {
        color: #ffad2f;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .12em;
      }

      .bulkPanelHeader h3 {
        margin: 6px 0;
        font-size: 23px;
      }

      .bulkPanelHeader p {
        margin: 0;
        max-width: 470px;
        color: rgba(255,255,255,.78);
        font-size: 13px;
        line-height: 1.5;
      }

      .bulkPanelBody {
        flex: 1;
        overflow-y: auto;
        padding: 22px 24px 36px;
      }

      .bulkPanelBody > label,
      .schedulePicker {
        display: grid;
        gap: 7px;
        margin-bottom: 16px;
      }

      .bulkPanelBody > label > span,
      .schedulePicker > span {
        color: #4e6682;
        font-size: 12px;
        font-weight: 800;
      }

      .bulkPanelBody select,
      .bulkPanelBody input[type="date"],
      .bulkPanelBody textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cfdbeb;
        border-radius: 12px;
        padding: 11px 12px;
        background: #fff;
        color: #102f54;
        font: inherit;
        outline: none;
      }

      .bulkPreview,
      .bulkInfoBox,
      .messageModeChoice {
        margin-bottom: 16px;
        padding: 14px;
        border: 1px solid #d6e2ef;
        border-radius: 14px;
        background: #fff;
      }

      .bulkPreview span,
      .bulkPreview small {
        display: block;
        color: #6b7f96;
      }

      .bulkPreview strong {
        display: block;
        margin: 4px 0;
        color: #0c355f;
      }

      .schedulePicker p {
        margin: 0;
        padding: 12px;
        border-radius: 10px;
        background: #eef3f8;
        color: #667a91;
      }

      .scheduleChoice {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 11px 12px;
        border: 1px solid #d8e3ef;
        border-radius: 11px;
        background: #fff;
        cursor: pointer;
      }

      .scheduleChoice input {
        width: 17px;
        height: 17px;
        accent-color: #1268d6;
      }

      .scheduleChoice strong {
        color: #123d69;
      }

      .scheduleChoice span {
        color: #526b85;
        font-size: 12px;
      }

      .bulkChecks {
        display: grid;
        gap: 9px;
        margin-bottom: 16px;
      }

      .bulkChecks label {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 10px 12px;
        border-radius: 11px;
        background: #fff;
        border: 1px solid #dbe5ef;
        color: #294866;
        font-size: 13px;
        font-weight: 700;
      }

      .bulkChecks input {
        width: 17px;
        height: 17px;
        accent-color: #1268d6;
      }

      .bulkInfoBox {
        background: #eef7ff;
        border-color: #c9e4fb;
      }

      .bulkInfoBox strong {
        color: #0e4e87;
      }

      .bulkInfoBox p {
        margin: 5px 0 0;
        color: #496986;
        font-size: 12px;
        line-height: 1.55;
      }

      .bulkResult {
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 11px;
        background: #eaf7ef;
        border: 1px solid #bde4cc;
        color: #17623b;
        font-size: 13px;
        font-weight: 800;
      }

      .bulkPanelFooter {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 20px;
        border-top: 1px solid #dce4ee;
        background: #fff;
      }

      .bulkPanelFooter button {
        border: 0;
        border-radius: 11px;
        padding: 11px 15px;
        font-weight: 900;
        cursor: pointer;
      }

      .bulkPanelFooter .ghost {
        border: 1px solid #ccd8e6;
        background: #fff;
        color: #294765;
      }

      .bulkPanelFooter .primary {
        background: #1268d6;
        color: #fff;
      }

      .bulkPanelFooter .primary.orange {
        background: #ff9418;
      }

      .messageModeChoice strong {
        display: block;
        margin-bottom: 7px;
        color: #1e4166;
      }

      .messageModeChoice div {
        display: grid;
        gap: 5px;
        color: #60758c;
        font-size: 12px;
      }

      .messageModeChoice .activeMode {
        color: #116c48;
        font-weight: 900;
      }


      .passiveSummaryCard {
        opacity: .76;
        background: #f5f7fa !important;
        border-style: dashed !important;
      }

      .passiveSummaryCard:hover {
        opacity: 1;
        border-color: #9bb6d6 !important;
      }

      .passiveSummaryCard.selected {
        opacity: 1;
        background: #eef5ff !important;
        border-style: solid !important;
      }

      .passiveSummaryCard small {
        display: block;
        margin-top: 4px;
        color: #8a99aa;
        font-size: 10px;
        font-weight: 700;
      }

      .studentActionButton.edit {
        border-color: #b9d3f4;
        background: #eff6ff;
        color: #0b5ab3;
      }

      .whatsappQueue {
        margin-top: 16px;
        border: 1px solid #b7dfc8;
        border-radius: 16px;
        background: #f2fbf6;
        overflow: hidden;
      }

      .whatsappQueueHead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
        border-bottom: 1px solid #cde9d7;
      }

      .whatsappQueueHead strong,
      .whatsappQueueHead span {
        display: block;
      }

      .whatsappQueueHead strong {
        color: #12633b;
      }

      .whatsappQueueHead span {
        margin-top: 3px;
        color: #51705f;
        font-size: 11px;
      }

      .sendFirstWhatsapp,
      .sendAllWhatsapp,
      .whatsappQueueList button {
        border: 0;
        border-radius: 10px;
        background: #1fa463;
        color: #fff;
        padding: 9px 11px;
        font-weight: 900;
        cursor: pointer;
      }

      .sendAllWhatsapp {
        padding: 11px 14px;
        box-shadow: 0 8px 18px rgba(31, 164, 99, .2);
        white-space: nowrap;
      }

      .whatsappQueueSummary {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 10px 14px;
        border-bottom: 1px solid #dcefe4;
        color: #567264;
        font-size: 11px;
      }

      .whatsappQueueSummary strong {
        color: #145d3a;
        font-size: 13px;
      }

      .whatsappQueueSummary i {
        color: #a5b7ad;
        font-style: normal;
      }

      .whatsappQueueList.compact > div,
      .whatsappQueueList.compact > label {
        min-height: 42px;
      }

      .whatsappSelectionActions {
        margin-left: auto;
        display: flex;
        gap: 6px;
      }

      .whatsappSelectionActions button {
        border: 1px solid #b7dfc8;
        border-radius: 8px;
        background: #fff;
        color: #12633b;
        padding: 6px 8px;
        font-size: 10px;
        font-weight: 900;
        cursor: pointer;
      }

      .whatsappRecipientRow {
        display: grid;
        grid-template-columns: 22px 24px 1fr auto;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-bottom: 1px solid #dcefe4;
        cursor: pointer;
      }

      .whatsappRecipientRow.selected {
        background: #edfaf3;
      }

      .whatsappRecipientRow.disabled {
        cursor: not-allowed;
        opacity: .62;
      }

      .whatsappRecipientRow > input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .whatsappCheckmark {
        width: 24px;
        height: 24px;
        border-radius: 7px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #a6d9bc;
        background: #fff;
        color: #fff;
        font-weight: 1000;
      }

      .whatsappRecipientRow.selected .whatsappCheckmark {
        background: #1fa463;
        border-color: #1fa463;
      }

      .recipientStatus {
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 10px;
        font-weight: 900;
      }

      .recipientStatus.ready {
        background: #dff5e8;
        color: #157044;
      }

      .recipientStatus.missing {
        background: #f7e9e9;
        color: #9b3b3b;
      }

      .whatsappLegalNote {
        padding: 10px 14px;
        border-top: 1px solid #dcefe4;
        background: #f8fcfa;
        color: #687d70;
        font-size: 10px;
        line-height: 1.5;
      }

      .whatsappQueueList {
        max-height: 240px;
        overflow-y: auto;
      }

      .whatsappQueueList > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 11px 14px;
        border-bottom: 1px solid #dcefe4;
      }

      .whatsappQueueList > div:last-child {
        border-bottom: 0;
      }

      .whatsappQueueList strong,
      .whatsappQueueList span {
        display: block;
      }

      .whatsappQueueList span {
        margin-top: 2px;
        color: #668071;
        font-size: 11px;
      }

      .whatsappQueueList button:disabled {
        opacity: .4;
        cursor: not-allowed;
      }


      .isWorking {
        position: relative;
        overflow: hidden;
        opacity: 1 !important;
        cursor: wait !important;
        box-shadow: 0 0 0 3px rgba(18, 104, 214, .12),
          0 10px 24px rgba(18, 104, 214, .22) !important;
        animation: operationPulse 1s ease-in-out infinite;
      }

      .isWorking::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          100deg,
          transparent 20%,
          rgba(255,255,255,.28) 45%,
          transparent 70%
        );
        transform: translateX(-120%);
        animation: operationSweep 1.1s linear infinite;
        pointer-events: none;
      }

      @keyframes operationPulse {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.08); }
      }

      @keyframes operationSweep {
        to { transform: translateX(120%); }
      }


      .informationSummary {
        background: linear-gradient(180deg, #fff8e9, #fffdf8) !important;
        border-color: #efcf97 !important;
      }

      .informationSummary span { color: #8a5713; }
      .informationSummary strong { color: #b86b08; }
      .informationSummary small {
        display: block;
        margin-top: 4px;
        color: #a77837;
        font-size: 10px;
        font-weight: 800;
      }

      .informationPendingBar {
        width: 100%;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
        margin: 0 0 12px;
        padding: 10px 11px;
        border: 1px solid #d5e4f2;
        border-radius: 12px;
        background: #f5f9fd;
        color: #173e63;
        text-align: left;
        cursor: pointer;
      }

      .informationPendingBar.important {
        border-color: #efcf98;
        background: #fff8ea;
      }

      .infoDot {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 9px;
        background: #0d69c7;
        color: #fff;
        font-weight: 950;
      }

      .informationPendingBar.important .infoDot {
        background: #e38a17;
      }

      .informationPendingBar strong,
      .informationPendingBar small { display: block; }

      .informationPendingBar strong { font-size: 12px; }

      .informationPendingBar small {
        margin-top: 2px;
        color: #6d8195;
        font-size: 10px;
      }

      .informationPendingBar b {
        color: #0b5da9;
        font-size: 11px;
        white-space: nowrap;
      }

      @media (max-width: 780px) {
        .studentCommandHeader {
          align-items: stretch;
          flex-direction: column;
          padding: 18px;
        }

        .commandActions {
          justify-content: flex-start;
        }

        .selectionToolbar {
          position: static;
          align-items: flex-start;
          flex-direction: column;
        }

        .selectionActions {
          margin-left: 0;
        }

        .bulkPanel {
          width: 100%;
        }
      }


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

.paymentStatusButton {
  width: 100%;
  min-height: 34px;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 7px 10px;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
}

.paymentStatusButton:hover {
  transform: translateY(-1px);
}

.paymentStatusButton.paymentWarn {
  color: #ffffff !important;
  background: #dc2626;
  border-color: #dc2626;
  box-shadow: 0 6px 14px rgba(220, 38, 38, .18);
}

.paymentStatusButton.paymentOk {
  color: #087443 !important;
  background: #ecfdf3;
  border-color: #bbf7d0;
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
          grid-template-columns: repeat(6, minmax(0, 1fr));
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

        .studentAgeBadge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          margin-top: 7px;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          background: #eff6ff;
          color: #0b63c9;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
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
            grid-template-columns: repeat(6, minmax(72px, 1fr));
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


/* SprintOS READY: profesyonel ikon, mobil ve çıktı işlem standardı */
.commandButton,
.studentActionButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}
.commandButton svg,
.studentActionButton svg { flex: 0 0 auto; }
.studentActionButton.print {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #334155;
}
.studentActionButton.delete {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}

@media (max-width: 760px) {
  .studentCommandHeader { padding: 18px 16px !important; border-radius: 18px !important; }
  .studentCommandHeader h2 { font-size: 22px !important; line-height: 1.15; }
  .studentCommandHeader p { font-size: 12px !important; margin-top: 7px !important; }
  .commandActions { display:grid !important; grid-template-columns:1fr 1fr !important; width:100%; gap:8px !important; }
  .commandButton { min-height:42px !important; padding:8px 10px !important; font-size:12px !important; }

  .summaryGrid {
    display:grid !important;
    grid-template-columns:repeat(2,minmax(0,1fr)) !important;
    overflow:visible !important;
    gap:8px !important;
  }
  .summaryCard { min-width:0 !important; padding:12px !important; border-radius:13px !important; }
  .summaryCard strong { font-size:22px !important; }
  .summaryCard small { font-size:9px !important; }

  .studentCard { padding:12px !important; border-radius:15px !important; }
  .cardHeader { margin-bottom:10px !important; }
  .mainDetails { gap:7px !important; margin-bottom:9px !important; }
  .mainDetails div,.dateRow div { padding:8px 9px !important; }
  .lessonStrip { grid-template-columns:repeat(3,minmax(0,1fr)) !important; overflow:visible !important; gap:6px !important; padding:8px !important; margin-bottom:9px !important; }
  .lessonStrip div { border-right:0 !important; border-bottom:1px solid #e3e8f0; padding:5px 2px; }
  .dateRow { gap:7px !important; }
  .cardFooter { gap:9px !important; margin-top:10px !important; padding-top:10px !important; }
  .studentActions { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:7px !important; width:100%; }
  .studentActionButton { width:100%; min-height:40px !important; padding:8px 8px !important; font-size:11px !important; border-radius:10px !important; }
  .studentActionButton.call,.studentActionButton.whatsapp { font-weight:800; }
}

@media (max-width: 420px) {
  .studentActions { grid-template-columns:1fr 1fr !important; }
  .mainDetails,.dateRow { grid-template-columns:1fr 1fr !important; }
}


/* SprintOS Öğrenci Merkezi — mobil profesyonel üst alan */
.summaryCard{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.summaryCard:active,.commandButton:active,.studentStatusTabs button:active,.dataPanelToggle:active{transform:scale(.975)}
.summaryCard.selected{border-color:#176fe8!important;box-shadow:0 0 0 2px rgba(23,111,232,.16),0 8px 20px rgba(23,111,232,.12)!important}
.summaryCard.selected span,.summaryCard.selected strong{color:#176fe8!important}

.studentStatusTabs{display:flex;gap:7px;padding:7px;margin:0 0 14px;border:1px solid #dbe6f3;border-radius:16px;background:#fff;overflow-x:auto}
.studentStatusTabs button{appearance:none;border:0;background:transparent;color:#60738d;border-radius:11px;min-height:42px;padding:0 16px;font-weight:800;white-space:nowrap;cursor:pointer}
.studentStatusTabs button.active{background:#176fe8;color:#fff;box-shadow:0 6px 16px rgba(23,111,232,.18)}
.studentStatusTabs b{margin-left:4px}
.startingSummaryCard{border-color:#f2c36b!important;background:#fffaf0!important}
.startingSummaryCard.selected{border-color:#f59e0b!important;box-shadow:0 8px 24px rgba(245,158,11,.14)!important}
.dataPanelShell{grid-column:1/-1}
.dataPanelToggle{width:100%;min-height:58px;border:1px solid #cfe0f3;border-radius:14px;background:#fff;color:#17345c;display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 12px;padding:10px 14px;text-align:left;cursor:pointer}
.dataPanelToggle>span{display:flex;align-items:center;gap:8px}
.dataPanelToggle small{grid-column:1;color:#71839a}
.dataPanelToggle>b{grid-column:2;grid-row:1/3;font-size:22px;color:#176fe8}
.primaryAction{background:#176fe8!important;color:#fff!important;border-color:#176fe8!important}
@media(max-width:760px){
  .studentCenter{padding-left:12px!important;padding-right:12px!important}
  .mobileProfessionalHeader{padding:14px!important}
  .mobileProfessionalHeader p{font-size:13px!important;line-height:1.45!important}
  .summaryGrid{gap:9px!important}
  .summaryCard{min-height:112px!important;padding:14px!important;border-radius:16px!important}
  .summaryCard span{font-size:13px!important}
  .summaryCard strong{font-size:28px!important}
  .toolbar{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;width:100%!important}
  .toolbar .searchBox,.dataPanelShell{grid-column:1!important;width:100%!important}
  .toolbar select{grid-column:1!important;width:100%!important;max-width:none!important;min-width:0!important;height:48px!important;font-size:14px!important}
  .toolbar .searchBox input{width:100%!important;max-width:none!important;box-sizing:border-box!important}
  .dataPanelShell,.dataPanelToggle{width:100%!important;max-width:none!important;box-sizing:border-box!important}
  .searchBox input{width:100%!important;min-width:0!important;height:48px!important}
  .dataPanelToggle{width:100%!important}
  .dataActions{grid-template-columns:1fr!important}
  .selectionToolbar{padding:14px!important}
  .mobileProfessionalHeader{padding:16px!important}
  .mobileProfessionalHeader h2{font-size:24px!important}
  .professionalQuickActions{grid-template-columns:1fr 1fr!important}
  .summaryGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .studentStatusTabs{
    position:sticky;
    top:0;
    z-index:8;
    display:grid;
    grid-template-columns:repeat(5,minmax(0,1fr));
    gap:4px;
    overflow:visible;
    width:100%;
    box-sizing:border-box;
  }
  .studentStatusTabs button{
    min-width:0;
    min-height:48px;
    padding:5px 3px;
    font-size:10px;
    line-height:1.05;
    text-align:center;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:3px;
    overflow:hidden;
  }
  .studentStatusTabs button b{
    margin-left:0;
    font-size:10px;
    line-height:1;
    font-weight:900;
  }
  .dataPanelToggle{min-height:54px}
}

/* SprintOS Öğrenci Merkezi — profesyonel filtre / veri işlemleri */
.toolbar {
  grid-template-columns: minmax(280px, 1.7fr) repeat(6, minmax(150px, 1fr)) !important;
  align-items: stretch;
}
.toolbar input,
.toolbar select {
  min-height: 52px !important;
  padding: 0 15px !important;
  border-radius: 14px !important;
  font-size: 14px !important;
  font-weight: 650;
  border-color: #cfdbea !important;
}
.toolbar input::placeholder { color: #8a9ab0; }
.dataActions {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 2px;
}
.dataAction {
  min-height: 68px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  border: 1px solid #d7e2ef;
  border-radius: 14px;
  background: #fff;
  color: #17345c;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: .16s ease;
}
.dataAction:hover { border-color:#8eb9ee; box-shadow:0 8px 22px rgba(20,73,132,.08); transform:translateY(-1px); }
.dataAction.primary { background:#176fe8; border-color:#176fe8; color:#fff; }
.dataAction.subtle { background:#f8fbff; }
.dataActionIcon {
  flex:0 0 42px; height:42px; display:grid; place-items:center;
  border-radius:11px; background:#edf5ff; color:#176fe8;
  font-size:10px; font-weight:900; letter-spacing:.04em;
}
.dataAction.primary .dataActionIcon { background:rgba(255,255,255,.16); color:#fff; }
.dataAction strong,.dataAction small { display:block; }
.dataAction strong { font-size:13px; line-height:1.25; }
.dataAction small { margin-top:4px; font-size:10px; line-height:1.35; color:#71839a; font-weight:600; }
.dataAction.primary small { color:rgba(255,255,255,.82); }
.selectionToolbar { margin-top: 16px; }
@media (max-width: 1050px) {
  .toolbar { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
  .dataActions { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
@media (max-width: 760px) {
  .toolbar input,.toolbar select { min-height:48px !important; font-size:14px !important; }
  .dataActions { grid-template-columns:1fr 1fr; gap:8px; }
  .dataAction { min-height:62px; padding:9px 10px; }
  .dataActionIcon { flex-basis:36px; height:36px; border-radius:10px; }
  .dataAction small { display:none; }
}
@media (max-width: 480px) {
  .dataActions { grid-template-columns:1fr; }
  .dataAction { min-height:56px; }
}

.studentNotePreview{
  width:100%;display:flex;align-items:center;gap:10px;margin:10px 0 12px;padding:11px 12px;
  border:1px solid #d7c9ff;border-radius:14px;background:#f8f5ff;color:#35236d;text-align:left;cursor:pointer;
}
.studentNotePreview:hover{border-color:#9f83ef;background:#f4efff}
.studentNoteIcon{font-size:19px;flex:0 0 auto}
.studentNoteCopy{display:grid;gap:3px;min-width:0;flex:1}
.studentNoteCopy strong{font-size:12px;color:#5b3cc4}
.studentNoteCopy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#4f5670;font-weight:650}
.studentNoteReminder{flex:0 0 auto;padding:6px 8px;border-radius:9px;background:#fff0d6;color:#9a4b00;font-size:10px;font-weight:900}
.studentNoteReminder.neutral{background:#ece8ff;color:#6548c5}
.studentNotePreview.due{border-color:#ef8c26;background:#fff6e9;animation:studentNotePulse 1.15s ease-in-out infinite}
.studentNotePreview.due .studentNoteReminder{background:#e86d00;color:#fff}
@keyframes studentNotePulse{0%,100%{box-shadow:0 0 0 0 rgba(232,109,0,.05)}50%{box-shadow:0 0 0 5px rgba(232,109,0,.18)}}
.studentActionButton.note{border-color:#d8cdfd!important;background:#f7f4ff!important;color:#6245c5!important}
.noteOverlay{position:fixed;inset:0;z-index:1000;background:rgba(9,24,44,.48);display:flex;justify-content:flex-end}
.notePanel{width:min(720px,96vw);height:100%;background:#f7faff;box-shadow:-20px 0 60px rgba(17,47,83,.2);overflow:auto}
.notePanelHeader{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:16px;padding:20px;background:#fff;border-bottom:1px solid #dbe5f0}
.notePanelHeader span{font-size:11px;font-weight:900;color:#6d55c7;letter-spacing:.06em}
.notePanelHeader h3{margin:4px 0 2px;color:#17345c}
.notePanelHeader p{margin:0;color:#71839a;font-size:12px}
.notePanelHeader>button{width:40px;height:40px;border:1px solid #d7e2ef;border-radius:12px;background:#fff;font-size:24px;color:#405a78;cursor:pointer}
.notePanelBody{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:14px;padding:14px}
.noteEditor,.noteHistory{background:#fff;border:1px solid #dbe5f0;border-radius:16px;padding:14px}
.noteEditor{display:grid;gap:12px;align-content:start}
.noteEditor label{display:grid;gap:6px;color:#566c86;font-size:12px;font-weight:800}
.noteEditor input,.noteEditor select,.noteEditor textarea{width:100%;box-sizing:border-box;border:1px solid #ccd9e8;border-radius:11px;background:#fff;padding:10px 11px;font:inherit;color:#17345c}
.noteEditor textarea{resize:vertical;min-height:110px}
.noteEditor small{color:#8290a2;line-height:1.35}
.noteEditorActions{display:flex;justify-content:flex-end;gap:8px}
.noteEditorActions button,.noteHistoryActions button{border:1px solid #cfdbea;border-radius:10px;background:#fff;color:#28496e;padding:9px 11px;font-weight:800;cursor:pointer}
.noteEditorActions .primary{background:#176fe8;border-color:#176fe8;color:#fff}
.noteEditorActions .ghost{background:#f7faff}
.noteError{padding:9px 10px;border:1px solid #f1b5a9;border-radius:10px;background:#fff0ed;color:#a73520;font-size:12px;font-weight:800}
.noteHistory{display:grid;gap:10px;align-content:start}
.noteHistoryTitle{display:flex;justify-content:space-between;align-items:center;color:#17345c}
.noteHistoryTitle span{display:grid;place-items:center;min-width:28px;height:28px;border-radius:9px;background:#edf4fc;color:#176fe8;font-weight:900}
.noteHistoryItem{border:1px solid #dbe5f0;border-radius:13px;padding:11px;background:#fbfdff}
.noteHistoryItem.due{border-color:#ef9b45;background:#fff8ef}
.noteHistoryItem>div:first-child{display:flex;justify-content:space-between;gap:8px;align-items:center}
.noteHistoryItem>div:first-child strong{color:#17345c;font-size:12px}
.noteHistoryItem>div:first-child small{color:#8898aa;font-size:10px}
.noteHistoryItem p{margin:8px 0;color:#3d526b;font-size:13px;line-height:1.45;white-space:pre-wrap}
.noteReminderLine{padding:7px 8px;border-radius:9px;background:#fff0d8;color:#955000;font-size:11px;font-weight:900}
.noteHistoryActions{display:flex;justify-content:flex-end;gap:6px;margin-top:9px}
.noteHistoryActions button{padding:7px 9px;font-size:11px}
.noteHistoryActions .danger{border-color:#f3c6c0;background:#fff4f2;color:#b33e2f}
.noteEmpty{padding:22px 10px;text-align:center;color:#8290a2;font-size:12px}
@media(max-width:760px){
  .studentNotePreview{align-items:flex-start}
  .studentNoteReminder{max-width:120px;text-align:center}
  .notePanel{width:100vw}
  .notePanelBody{grid-template-columns:1fr}
  .notePanelHeader{padding:16px}
}

/* Mobile final override: must remain after desktop/tablet toolbar rules */
@media (max-width: 760px) {
  .studentCenter .toolbar {
    display:grid !important;
    grid-template-columns:minmax(0,1fr) !important;
    width:100% !important;
    max-width:none !important;
    gap:8px !important;
    box-sizing:border-box !important;
  }
  .studentCenter .toolbar > .searchBox,
  .studentCenter .toolbar > select,
  .studentCenter .toolbar > .dataPanelShell {
    grid-column:1 / -1 !important;
    width:100% !important;
    max-width:none !important;
    min-width:0 !important;
    box-sizing:border-box !important;
  }
  .studentCenter .toolbar .searchBox,
  .studentCenter .toolbar .searchBox input,
  .studentCenter .toolbar select,
  .studentCenter .toolbar .dataPanelToggle {
    width:100% !important;
    max-width:none !important;
    min-width:0 !important;
    box-sizing:border-box !important;
  }
  .studentCenter .toolbar select,
  .studentCenter .toolbar .searchBox input {
    min-height:46px !important;
  }
  .studentCenter .dataPanelShell { margin-top:2px !important; }
}
      `}</style>
    </div>
  );
}