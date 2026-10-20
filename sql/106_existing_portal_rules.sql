-- Existing wording from app/on-kayit/pre-registration-form.tsx and pre-reg-enhancements.tsx.
-- Informational publication only: no consent is created or required retroactively.
insert into public.guardian_documents(organization_id,title,summary,body,document_type,version,requires_consent,is_active,sort_order)
select '2aa21b5f-ba88-484e-b450-e50bcc7f2f7d'::uuid,'Sprint Yüzme Okulu Kurs Kuralları',
'Ön kayıt formunda yer alan mevcut kurs kuralları. Bu belge bilgilendirme amaçlıdır.',
$rules$1. Telafi dersi
Hastalık, tatil, izin, şehir dışı veya benzeri bireysel nedenlerle kaçırılan dersler için telafi dersi uygulanmaz. Telafi yalnızca tesis / havuz kaynaklı olarak dersin yapılamadığı durumlarda tanımlanır.

2. Kayıt dondurma ve ders ekleme
Bireysel nedenlerle kayıt dondurma, kullanılmayan dersleri ileri tarihe aktarma veya pakete ek ders tanımlama yapılmaz.

3. Ücret ve indirim
Başlanan veya planlanan kurs paketlerinde bireysel devamsızlıklara bağlı ücret indirimi, ders başına ücret düşümü veya geriye dönük indirim uygulanmaz.

4. Grup ve saat düzeni
Eğitim kalitesi, seviye dengesi, tesis programı ve operasyon ihtiyacına göre grup, saat, kulvar veya antrenör planlaması Sprint Yüzme Okulu tarafından güncellenebilir.

5. Sağlık ve güvenlik
Öğrenci / katılımcının antrenör tarafından bilinmesi gereken sağlık, alerji, özel gereksinim veya güvenliği etkileyebilecek durumları kayıt öncesinde bildirmek kursiyer / veli sorumluluğundadır.

6. Ön kayıt
Bu formun gönderilmesi kesin kayıt, kesin kontenjan veya ödeme onayı anlamına gelmez. Kesin kayıt, kayıt ekibinin teyidiyle tamamlanır.

7. İptal ve ücret iadesi
Kesin kaydı tamamlanarak kursa başlayan öğrenci / katılımcı için kurs iptali ve ücret iadesi yapılmaz. Başlanan kurs paketi başka bir döneme devredilemez ve kullanılmayan dersler için ücret iadesi talep edilemez.$rules$,
'information',1,false,true,0
where not exists(select 1 from public.guardian_documents where organization_id='2aa21b5f-ba88-484e-b450-e50bcc7f2f7d'::uuid and title='Sprint Yüzme Okulu Kurs Kuralları');
