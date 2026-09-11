"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type PermissionResponse = {
  ok: boolean;
  isSuperUser: boolean;
  permissions: Record<string, boolean>;
};

type Rule = { key: string; labels: string[] };

const RULES: Rule[] = [
  { key: "students.create", labels: ["Öğrenci Ekle", "Yeni Öğrenci"] },
  { key: "students.edit", labels: ["Öğrenci Düzenle", "Bilgileri Düzenle"] },
  { key: "students.delete", labels: ["Öğrenci Sil"] },
  { key: "students.export", labels: ["Öğrencileri Dışa Aktar", "Öğrenci Listesini İndir"] },
  { key: "students.import", labels: ["Öğrencileri İçeri Aktar", "Excel / CSV Aktar"] },
  { key: "students.message", labels: ["Öğrenciye Mesaj Gönder", "Toplu Mesaj", "Akıllı Mesaj"] },
  { key: "students.transfer", labels: ["Grup / Şube Aktarımı Yap", "Grup Değiştir", "Şube Değiştir"] },
  { key: "students.renew", labels: ["Kayıt Yenile", "Kaydı Yenile"] },
  { key: "students.archive", labels: ["Öğrenciyi Arşivle", "Pasife Al"] },
  { key: "students.bulk_operations", labels: ["Toplu Öğrenci İşlemleri", "Toplu İşlem"] },

  { key: "preregistration.create", labels: ["Ön Kayıt Oluştur", "Yeni Ön Kayıt"] },
  { key: "preregistration.edit", labels: ["Ön Kayıt Düzenle"] },
  { key: "preregistration.approve", labels: ["Ön Kaydı Onayla", "Kayda Aktar", "Kesin Kayda Aktar"] },

  { key: "groups.create", labels: ["Grup Oluştur", "Yeni Grup"] },
  { key: "groups.edit", labels: ["Grup Düzenle"] },
  { key: "groups.assign_student", labels: ["Gruba Öğrenci Ata", "Öğrenci Ata"] },
  { key: "groups.delete", labels: ["Grup Sil", "Grubu Sil", "Grup Sil / Arşivle"] },
  { key: "groups.assign_staff", labels: ["Gruba Eğitmen Ata", "Eğitmen Ata"] },

  { key: "schedule.create", labels: ["Ders Programı Oluştur", "Program Oluştur"] },
  { key: "schedule.edit", labels: ["Ders Programını Değiştir", "Programı Düzenle"] },
  { key: "schedule.disable", labels: ["Ders Programını Pasif Yap", "Programı Pasif Yap"] },

  { key: "operations.assign_staff", labels: ["Personel Ata"] },
  { key: "operations.assign_student", labels: ["Öğrenci Ata"] },
  { key: "operations.assign_group", labels: ["Grup Ata", "Grup Ata / Değiştir"] },
  { key: "operations.assign_lane", labels: ["Kulvar Ata"] },

  { key: "attendance.take", labels: ["Yoklama Al", "Yoklamayı Kaydet", "Yoklamayı Güncelle", "Taslağı Kaydet"] },
  { key: "attendance.edit", labels: ["Yoklama Düzenle"] },
  { key: "attendance.compensation", labels: ["Telafi / Ders Ekleme İşlemi", "Telafi Ekle", "Hediye Ders Ekle"] },

  { key: "finance.payment_create", labels: ["Ödeme Al", "Ödemeyi Kaydet"] },
  { key: "finance.payment_edit", labels: ["Ödeme Kaydını Düzenle", "Ödemeyi Düzenle"] },
  { key: "finance.payment_cancel", labels: ["Ödeme İptal Talebi Oluştur", "Ödeme İptal"] },
  { key: "finance.cash_deliver", labels: ["Kasaya Teslim Et"] },
  { key: "finance.cash_approve", labels: ["Kasa Teslimini Onayla"] },
  { key: "finance.debt_create", labels: ["Borçlandırma Oluştur", "Borç Ekle"] },
  { key: "finance.debt_edit", labels: ["Borçlandırmayı Düzenle"] },
  { key: "finance.debt_cancel", labels: ["Borçlandırmayı İptal Et"] },
  { key: "finance.discount", labels: ["İndirim Uygula"] },
  { key: "finance.refund", labels: ["İade İşlemi Yap", "İade Yap"] },
  { key: "finance.export", labels: ["Muhasebe Verilerini Dışa Aktar"] },

  { key: "staff.create", labels: ["Personel Ekle", "Yeni Personel"] },
  { key: "staff.edit", labels: ["Personel Düzenle"] },
  { key: "staff.disable", labels: ["Personeli Pasif Yap"] },
  { key: "staff.branches", labels: ["Personel Şubelerini Değiştir"] },

  { key: "accounts.create", labels: ["Giriş Hesabı Oluştur"] },
  { key: "accounts.disable", labels: ["Giriş Yetkisini Aç / Kapat", "Girişi Kapat", "Girişi Aç"] },
  { key: "accounts.reset_password", labels: ["Geçici Şifre Oluştur / Sıfırla", "Şifre Sıfırla"] },
  { key: "accounts.send_credentials", labels: ["Giriş Bilgilerini Gönder"] },

  { key: "permissions.edit", labels: ["Yetkileri Değiştir"] },
  { key: "permissions.super_user", labels: ["Süper Kullanıcı Yetkisini Değiştir"] },

  { key: "approvals.approve", labels: ["İşlem Talebini Onayla", "Onayla"] },
  { key: "approvals.reject", labels: ["İşlem Talebini Reddet", "Reddet"] },
  { key: "approvals.rules_manage", labels: ["Onay Kurallarını Yönet"] },

  { key: "reports.export", labels: ["Raporları Dışa Aktar", "PDF İndir", "Excel İndir"] },
  { key: "branches.manage", labels: ["Şubeleri Yönet", "Şube Ekle", "Şube Düzenle"] },
];

const ROUTE_RULES: Array<[string, string]> = [
  ["/ogrenciler", "students.view"],
  ["/on-kayit", "preregistration.view"],
  ["/gruplar", "groups.view"],
  ["/ders-program", "schedule.view"],
  ["/operasyon-plani", "operations.view"],
  ["/yoklama", "attendance.view"],
  ["/odem", "finance.view"],
  ["/kasa", "finance.cash_view"],
  ["/rapor", "reports.view"],
  ["/kullanicilar-ve-yetkiler", "permissions.view"],
  ["/sube", "branches.view"],
];

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
}

function matchingPermission(text: string) {
  const value = normalize(text);
  if (!value) return null;
  for (const rule of RULES) {
    if (rule.labels.some((label) => value === normalize(label) || value.startsWith(`${normalize(label)} `))) return rule.key;
  }
  return null;
}

function routePermission(href: string) {
  if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  const path = href.split("?")[0];
  const found = ROUTE_RULES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return found?.[1] || null;
}

export default function PermissionUiGuard() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function boot() {
      const response = await fetch("/api/me/permissions", { cache: "no-store", credentials: "same-origin" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = (await response.json()) as PermissionResponse;
      if (!data.ok || data.isSuperUser || cancelled) return;

      const allowed = (key: string) => data.permissions[key] === true;

      const apply = () => {
        document.querySelectorAll<HTMLElement>("button,a,[role='button']").forEach((element) => {
          if (element.closest("[data-permission-admin-panel]")) return;
          let key = matchingPermission(element.innerText || element.textContent || "");
          if (!key && element instanceof HTMLAnchorElement) key = routePermission(element.getAttribute("href") || "");
          if (!key) return;

          if (allowed(key)) {
            if (element.dataset.permissionGuard === "denied") {
              element.style.removeProperty("opacity");
              element.style.removeProperty("filter");
              element.style.removeProperty("pointer-events");
              element.removeAttribute("aria-disabled");
              element.removeAttribute("title");
              if (element instanceof HTMLButtonElement) element.disabled = false;
              delete element.dataset.permissionGuard;
            }
            return;
          }

          element.dataset.permissionGuard = "denied";
          element.setAttribute("aria-disabled", "true");
          element.setAttribute("title", "Bu işlem için kullanıcı yetkisi kapalı.");
          element.style.opacity = "0.46";
          element.style.filter = "grayscale(.15)";
          element.style.pointerEvents = "none";
          if (element instanceof HTMLButtonElement) element.disabled = true;
        });
      };

      apply();
      observer = new MutationObserver(apply);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    void boot();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
