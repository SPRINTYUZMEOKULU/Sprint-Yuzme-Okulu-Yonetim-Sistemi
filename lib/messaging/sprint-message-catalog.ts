export type SprintMessageKey =
  | "registration"
  | "renewal"
  | "freeze"
  | "compensation"
  | "absence"
  | "payment"
  | "lesson_ending"
  | "lesson_finished"
  | "program"
  | "pool_closed"
  | "hygiene"
  | "technical"
  | "group_transfer"
  | "time_change"
  | "coach_change"
  | "gift"
  | "general";

export type SprintMessageTemplate = {
  key: SprintMessageKey;
  title: string;
  icon: string;
  category: "registration" | "lesson" | "payment" | "operation" | "gift" | "general";
  body: string;
};

export const SPRINT_MESSAGE_TEMPLATES: SprintMessageTemplate[] = [
  {
    key: "registration",
    title: "Kayıt Tamamlandı",
    icon: "✅",
    category: "registration",
    body:
      "*SPRİNT YÜZME OKULU | KAYIT BİLGİLENDİRMESİ*\n\n" +
      "Değerli Velimiz,\n\n" +
      "*{ogrenci_adi}* öğrencimizin kaydı başarıyla tamamlanmıştır. 💙\n\n" +
      "🏊 *Şube:* {sube}\n" +
      "👥 *Grup:* {grup}\n" +
      "🗓️ *Program:* {program}\n" +
      "📅 *Başlangıç:* {baslangic_tarihi}\n" +
      "🏁 *Planlanan bitiş:* {bitis_tarihi}\n\n" +
      "Ders programınız ve kayıt bilgileriniz SprintOS kursiyer dosyanıza işlenmiştir.\n\n" +
      "*SPRİNT YÜZME OKULU*\nBilgilendirme Hattı: 0551 896 83 19",
  },
  {
    key: "renewal",
    title: "Kayıt Yenileme",
    icon: "🔄",
    category: "registration",
    body:
      "*SPRİNT YÜZME OKULU | KAYIT YENİLEME*\n\n" +
      "Değerli Velimiz,\n\n" +
      "*{ogrenci_adi}* öğrencimizin mevcut yüzme programında kalan ders hakkı *{kalan_ders} ders*tir.\n\n" +
      "🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n🗓️ *Program:* {program}\n🏁 *Planlanan bitiş:* {bitis_tarihi}\n\n" +
      "Eğitimin kesintisiz devam etmesi için kayıt yenileme işleminizi tamamlayabilirsiniz.\n\n" +
      "*SPRİNT YÜZME OKULU*\nBilgilendirme Hattı: 0551 896 83 19",
  },
  {
    key: "freeze",
    title: "Kayıt Durumu Bilgilendirmesi",
    icon: "⏸️",
    category: "registration",
    body:
      "*SPRİNT YÜZME OKULU | KAYIT DURUMU*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin kayıt durumuyla ilgili bilgilendirme için sizinle iletişime geçiyoruz.\n\n" +
      "🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n🗓️ *Program:* {program}\n\n" +
      "Detaylı bilgi için Sprint Yüzme Okulu ile iletişime geçebilirsiniz.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "compensation",
    title: "Telafi Dersi",
    icon: "🟣",
    category: "lesson",
    body:
      "*SPRİNT YÜZME OKULU | TELAFİ DERSİ*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimiz için telafi dersi sistemimize eklenmiştir.\n\n" +
      "🟣 *Telafi tarihi:* {telafi_tarihi}\n🏊 *Telafi grubu:* {telafi_grubu}\n🕐 *Telafi saati:* {telafi_saati}\n" +
      "📌 *Normal planlanan bitiş:* {normal_bitis_tarihi}\n✅ *Güncel planlanan bitiş:* {bitis_tarihi}\n\n" +
      "Ders hakkınız kursiyer dosyanızda korunmaktadır.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "absence",
    title: "Derse Katılım Bilgilendirmesi",
    icon: "📋",
    category: "lesson",
    body:
      "*SPRİNT YÜZME OKULU | DERS KATILIMI*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin *{son_devamsizlik_tarihi}* tarihli dersimize katılım sağlayamadığı görülmektedir.\n\n" +
      "🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n🗓️ *Program:* {program}\n\n" +
      "Bir sonraki dersiniz mevcut program doğrultusunda devam edecektir.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "payment",
    title: "Ödeme Bilgilendirmesi",
    icon: "💳",
    category: "payment",
    body:
      "*SPRİNT YÜZME OKULU | ÖDEME BİLGİLENDİRMESİ*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin ödeme durumuna ilişkin güncel bilgi aşağıdadır.\n\n" +
      "💳 *Kalan ödeme:* {kalan_odeme}\n📅 *Vade tarihi:* {vade_tarihi}\n🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n\n" +
      "Ödeme yaptıysanız bu mesajı dikkate almayabilirsiniz. Detaylı bilgi için bize ulaşabilirsiniz.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "lesson_ending",
    title: "Ders Hakkı Azaldı",
    icon: "⏳",
    category: "lesson",
    body:
      "*SPRİNT YÜZME OKULU | DERS HAKKI BİLGİLENDİRMESİ*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin paketinde *{kalan_ders} ders* kalmıştır.\n\n" +
      "🏁 *Planlanan bitiş:* {bitis_tarihi}\n🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n🗓️ *Program:* {program}\n\n" +
      "Eğitimin kesintisiz sürmesi için kayıt yenileme işleminizi planlayabilirsiniz.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "lesson_finished",
    title: "Ders Hakkı Tamamlandı",
    icon: "🏁",
    category: "lesson",
    body:
      "*SPRİNT YÜZME OKULU | PAKET TAMAMLANDI*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin mevcut paketindeki ders hakları tamamlanmıştır.\n\n" +
      "🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n🗓️ *Program:* {program}\n\n" +
      "Yeni dönem kayıt ve program bilgisi için bizimle iletişime geçebilirsiniz.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "program",
    title: "Program Bilgilendirmesi",
    icon: "🗓️",
    category: "lesson",
    body:
      "*SPRİNT YÜZME OKULU | PROGRAM BİLGİLENDİRMESİ*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin güncel yüzme programı aşağıdaki gibidir.\n\n" +
      "🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n🗓️ *Program:* {program}\n\n" +
      "Derslerinize belirtilen gün ve saatte devam edebilirsiniz.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "pool_closed",
    title: "Havuz Kapalı",
    icon: "🏊",
    category: "operation",
    body:
      "*SPRİNT YÜZME OKULU | DERS BİLGİLENDİRMESİ*\n\n" +
      "Değerli Velimiz,\n\n*{sube}* şubemizdeki *{program}* seansımız tesis yönetimi kaynaklı kapanış nedeniyle gerçekleştirilemeyecektir.\n\n" +
      "Ders hakkınız sisteminizde korunacaktır. Diğer şubelerimizdeki derslerimiz planlandığı şekilde devam etmektedir.\n\n" +
      "*SPRİNT YÜZME OKULU*\nBilgilendirme Hattı: 0551 896 83 19",
  },
  {
    key: "hygiene",
    title: "Hijyen / Bakım Nedeniyle Ders İptali",
    icon: "🧼",
    category: "operation",
    body:
      "*SPRİNT YÜZME OKULU | TESİS BİLGİLENDİRMESİ*\n\n" +
      "Değerli Velimiz,\n\n*{sube}* şubemizdeki *{program}* seansımız tesis yönetiminin hijyen / bakım çalışması nedeniyle bugün gerçekleştirilemeyecektir.\n\n" +
      "İptal edilen ders hakkınız sisteminize telafi olarak eklenecek ve ayrıca bilgilendirileceksiniz.\n\n" +
      "*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "technical",
    title: "Teknik Nedenle Ders İptali",
    icon: "🛠️",
    category: "operation",
    body:
      "*SPRİNT YÜZME OKULU | TESİS BİLGİLENDİRMESİ*\n\n" +
      "Değerli Velimiz,\n\n*{sube}* şubemizdeki *{program}* seansımız tesis kaynaklı teknik çalışma nedeniyle bugün gerçekleştirilemeyecektir.\n\n" +
      "Ders hakkınız korunacak ve telafi planı ayrıca bildirilecektir.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "group_transfer",
    title: "Grup / Şube Aktarımı",
    icon: "🔁",
    category: "operation",
    body:
      "*SPRİNT YÜZME OKULU | PROGRAM GÜNCELLEMESİ*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin yüzme programı güncellenmiştir.\n\n" +
      "🏊 *Yeni şube:* {sube}\n👥 *Yeni grup:* {grup}\n🗓️ *Yeni program:* {program}\n📅 *Geçiş tarihi:* {gecis_tarihi}\n🏁 *Güncel planlanan bitiş:* {bitis_tarihi}\n\n" +
      "Kalan ders haklarınız yeni programınıza aktarılmıştır.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "time_change",
    title: "Seans / Saat Değişikliği",
    icon: "🕐",
    category: "operation",
    body:
      "*SPRİNT YÜZME OKULU | SAAT DEĞİŞİKLİĞİ*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin güncel ders programı *{program}* olarak düzenlenmiştir.\n\n" +
      "🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n\n" +
      "Derslerinize yeni program doğrultusunda devam edebilirsiniz.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "coach_change",
    title: "Antrenör Bilgilendirmesi",
    icon: "🏅",
    category: "operation",
    body:
      "*SPRİNT YÜZME OKULU | ANTRENÖR BİLGİLENDİRMESİ*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimizin *{program}* seansına ilişkin antrenör görevlendirmesinde güncelleme yapılmıştır.\n\n" +
      "🏊 *Şube:* {sube}\n👥 *Grup:* {grup}\n\n" +
      "Ders programınızda başka bir değişiklik bulunmamaktadır.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "gift",
    title: "SPRİNT Hediye Ders",
    icon: "🎁",
    category: "gift",
    body:
      "🎁 *SPRİNT YÜZME OKULU'NDAN HEDİYE DERS*\n\n" +
      "Değerli Velimiz,\n\n*{ogrenci_adi}* öğrencimiz için SPRİNT YÜZME OKULU tarafından *{hediye_ders} adet yüzme dersi* hediye edilmiştir. 💙\n\n" +
      "🏊 *Grup:* {grup}\n🗓️ *Ders planı:* {program}\n📌 *Önceki planlanan bitiş:* {normal_bitis_tarihi}\n✅ *Yeni planlanan bitiş:* {bitis_tarihi}\n\n" +
      "Hediye dersleriniz sisteminize işlenmiş ve ders hakkınıza eklenmiştir.\n\n*SPRİNT YÜZME OKULU*\n0551 896 83 19",
  },
  {
    key: "general",
    title: "Genel Duyuru",
    icon: "📣",
    category: "general",
    body:
      "*SPRİNT YÜZME OKULU | BİLGİLENDİRME*\n\nDeğerli Velimiz,\n\n{mesaj}\n\n*SPRİNT YÜZME OKULU*\nBilgilendirme Hattı: 0551 896 83 19",
  },
];

export const SPRINT_MESSAGE_TEMPLATE_MAP = Object.fromEntries(
  SPRINT_MESSAGE_TEMPLATES.map((item) => [item.key, item]),
) as Record<SprintMessageKey, SprintMessageTemplate>;

export function renderSprintMessage(
  body: string,
  values: Record<string, string | number | null | undefined>,
) {
  return body.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === null || value === undefined || value === "" ? "—" : String(value);
  });
}
