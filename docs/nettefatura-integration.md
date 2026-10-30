# Havale/EFT belge entegrasyonu

## Mevcut uygulama

- `/odeme-bilgileri`: öğrenciye özel UUID bağlantısı oluşturur; müşteri belge bilgilerini ve onayı kendisi girer.
- `/odeme-belge/[token]`: banka bilgileri form tamamlandıktan sonra açılır. Süresi dolmuş/iptal talepler öğrenci ismini veya banka bilgilerini göstermez. Ödemesi eşleştirilen taleplerde tekrar ödeme istenmez.
- `/odeme-bilgileri/belgeler`: yönetici/muhasebe için kurum kapsamlı kontrol ekranı. Müşterinin TCKN/VKN/adresi istemci bileşenlerine gönderilmez veya ekranda gösterilmez.
- Yalnızca owner/admin mevcut, alınmış TRY havale/EFT ödemesini aynı öğrenci/dönem/tutardaki talebe bağlayabilir. Bu işlem yeni ödeme/kasa satırı yaratmaz, fatura onayı veya banka doğrulaması yerine geçmez. payment_id üzerindeki mevcut unique index bir ödeme kaydının iki talebe bağlanmasını engeller.
- Yeni talebin belge türü `pending_classification` olur. Eski `e_smm` kayıtları değiştirilmez; ekranda doğrulama uyarısı gösterilir.

## Sağlanan sağlayıcı dokümanında doğrulanan işlemler

İş Net e-Fatura: `GetTaxPayer` aktif alıcı etiketleri döndürürse e-Fatura, aksi durumda e-Arşiv akışı. `SendInvoice`, `SearchInvoice`, `GetDocumentViewerLink`.
İş Net e-Arşiv: `SendArchiveInvoice`, `SearchArchiveInvoice`, `GetDocumentViewerLink`.
SOAP alanlarının sırası sağlayıcı sözleşmesine uygun olmalıdır. PDF/XML sonuçları desteklenir.

Test adresleri:
- https://einvoiceservicetest.isnet.net.tr/InvoiceService/ServiceContract/InvoiceService.svc
- https://einvoiceservicetest.isnet.net.tr/AddressBookService/ServiceContract/AddressBookService.svc

## Tamamlanmadan gönderim açılmayacak maddeler

1. Sağlayıcıdan test firma VKN'si ve test kullanım talimatlarını edin. e-Arşiv işlemleri aynı InvoiceService HTTPS uç noktasının WSDL sözleşmesinde doğrulandı.
2. WSDL XML alındı: SendInvoice, SendArchiveInvoice, SearchArchiveInvoice ve GetDocumentViewerLink işlemleri HTTPS binding içinde mevcut. SOAP HealthCheck çağrısı 2026-10-15 (İstanbul) tarihinde HTTP 200 / true döndü. Bu yalnızca servis erişimini doğrular, firma VKN yetkisini doğrulamaz. Tipli gönderim istemcisi ve şirket yetkisi ayrıca test edilmeli.
3. Vergi/matrah/hizmet açıklaması ve belge türünü işletmenin muhasebe ayarlarıyla doğrula; dekonttan tahmin etme.
4. Sunucu tarafında yönetici onay kaydı, onaylanan içerik özeti, atomik gönderim kilidi ve sağlayıcıya verilen kalıcı ExternalInvoiceCode/ExternalArchiveInvoiceCode saklama ekle. Belirsiz timeout sonrası yeniden göndermeden önce aynı kodla sorgula. Onay sonrası ödeme değişiklikleri/iptallerinde gönderimi engelle.
5. Test faturalarının sağlayıcı/GİB test kontrollerinden başarıyla tamamlandığını sorgulayarak doğrula.
6. Gerçek fatura çağrısını yapacak sunucunun sabit çıkış IP'sini firma VKN'siyle sağlayıcıya tanımlat. Rastgele/geçici geliştirme IP'sini canlıya tanımlatma.
7. Canlı servis adresleri ve yetki doğrulandıktan sonra yönetici onaylı gönderimi aç.
8. Sağlayıcı sonucu belge ID/numarasıyla sakla; PDF/XML'yi yetkili öğrenci dosyasına bağla. Erişim linklerini herkese açık loglara koyma.

Banka hareketleri aşağıdaki kontrollü Excel aktarımıyla alınır. 30 Ekim ekinde yalnız test ortamı için hazırlanan e-SMM istemcisinin kapsamı açıklanmıştır. IBAN hareketlerini otomatik almak ayrıca VakıfBank bağlantısı gerektirir. Otomatik öğrenci eşleştirmesi yalnızca isim/tutarla kesin kabul edilmemelidir.

## Fatura Merkezi ve Excel alternatif yolu

Ana menü → Fatura Merkezi (`/fatura-merkezi`). Kesilen Faturalar sekmesi aynı payment_document_requests kayıtlarındaki sağlayıcı ID/numarası ve belge bağlantılarını gösterir; geçmiş NetteFatura arşivini henüz çekmez. PDF/XML erişimi rol ve kurum kontrolünden geçer; yalnızca doğrulanmış HTTPS sağlayıcı alan adlarına yönlendirilir.

`/fatura-merkezi/banka`: Excel/CSV dosyası en fazla 5 MB ve bir yüklemede 500 hareket. Sütunlar ve başlık satırı açıkça seçilir, yalnızca kontrol edilerek seçilen pozitif TRY girişler kaydedilir. Ham dosya sunucuya gönderilmez; normalize satırlar ve dosyanın SHA256 özeti saklanır. Tarihler Türkiye saatine göre okunur. Bakiye/borç sütununu seçmeyiniz. Başlıktaki hesap IBAN'ı bankadan doğrulanmalıdır; yalnızca mevcut yapılandırılmış VakıfBank hesabı desteklenir.

invoice_bank_entries yalnızca kontrol kuyruğudur; yeni tahsilat/kasa/fatura yaratmaz. Aynı banka referansı veya aynı dosya/sayfa/satır tekrarı eklenmez. Referans numarası aynı ama içerik farklıysa yükleme durur. Referanssız benzer kayıtlar tutulur, gerekçeli ayrı işlem onayı veya mükerrer dışlama gerekir. Yetkili yönetici gerçek ödeme sahibini/kursiyeri seçer; tek bir hareket için atomik olarak tek bir ortak belge talebi yaratılır. Bu talep mevcut güvenli müşteri formunu ve ödeme eşleştirme adımını kullanır. Gönderen adı, fatura alıcısının TCKN/VKN/adres bilgileri yerine geçmez.

Banka kayıtları ve kontrol görünümü anon/authenticated rollerine kapalıdır. Server-side servis rolü her sorguyu organization_id ile sınırlar. Link RPC security invoker çalışır, yalnızca service_role çağırabilir; aktif yönetici ve kurum kontrolü yapar. RLS politika yok uyarısı burada beklenen kapalı erişimdir.

Testler: `node scripts/test-bank-import.cjs`, `node scripts/test-payment-documents.cjs`, `npm run typecheck`, `npm run build`. `scripts/test-invoice-bank-db.sql` aktif bir owner/kursiyer bağlamında sentetik banka kaydıyla atomik talep, tekrar ve kurum kontrolünü dener; transaction sonunda rollback yapar. Gerçek ödeme/fatura gönderimi yapmaz.

## VakıfBank dosya biçimi (23 Ekim 2026)

Hesap özeti üzerindeki IBAN ve HESAP NO / TUTAR / B/A / AÇIKLAMA başlıkları tanınır. Tanınan dosyada elle sütun seçimi gerekmez. IBAN tanımlı hesaptan farklıysa aktarım engellenir. Yalnız A (alacak), pozitif tutar ve gelen FAST / alınan havale / gelen EFT türleri seçilir. Tarih HAREKET TARIH, referans İŞLEM NO sütunundan okunur. Gönderen, açıklamadaki açık banka cümlesinden ayrıştırılır; belirsiz adlar aktarım dışında tutulur. Gönderen adı belge alıcısı kabul edilmez.

Yüklenen gerçek dosya yerel olarak test edildi: 27 gelen ödeme, 130.700 TL. Dosya veya kişisel banka verileri repoya eklenmedi. Pozitif tutarlı borç satırı, yanlış IBAN, bilinmeyen işlem türü, belirsiz gönderen ve eksik referans için sentetik regresyon testleri eklendi. Dosyanın okunması sunucuya aktarım veya makbuz oluşturma anlamına gelmez.

## e-SMM için kalan bağlantı

Kullanıcının seçtiği ürün İşNet NetteFatura e-SMM'dir. Yukarıdaki InvoiceService e-Fatura/e-Arşiv yöntemlerinin e-SMM için geçerli olduğu doğrulanmadı. e-Arşiv testi e-SMM gönderiminin kanıtı sayılmaz. e-SMM servis sözleşmesi, test şirketi/yetki bilgileri, hizmet/vergi ayarları ve gerekiyorsa sabit çıkış IP yetkisi doğrulanmadan gönderim açılmaz. Vergi oranı dekonttan veya paket fiyatından tahmin edilmez.

23 Ekim kontrolünde Vercel proje ortam ayarlarına mevcut bağlantıyla erişim 403 döndü. Bu nedenle sağlayıcı değişkenlerinin mevcut olup olmadığı doğrulanamadı; eksik oldukları varsayılmadı. Gönderim istemcisi ve atomik yönetici onay akışı henüz uygulanmış değildir.

## 28 Ekim 2026 kontrolü

- #147 güncel main ile çakışmasız birleştirildi. Mevcut veli menüsü ve aktif/pasif öğrenci düzenlemesi korunuyor.
- SprintOS-BULUT üzerinde banka tablosu/görünümü/RPC ve ödeme-belge tablosu mevcut. Salt okunur kontrolde 0 banka hareketi, 1 waiting_customer/e_smm talebi, 0 sağlayıcı belgesi görüldü. Gerçek banka/ödeme verisi eklenmedi.
- Vercel proje ayarlarına erişim artık başarılı. Production/preview ortam anahtarlarında İşNet/NetteFatura yapılandırması yok; değerler açılmadı.
- Fatura Merkezi hazır banka aktarımı ve ödeme eşleştirme aşamalarını, eksik e-SMM gönderim/onay/test aşamalarından açıkça ayırır.
- e-SMM sözleşmesi/test erişimi ve muhasebe hizmet/vergi ayarları elde edilmeden sağlayıcı istemcisi uydurulmadı, canlı gönderim açılmadı. Resmi İşNet SSS harici yazılımlar için web servis başvurusu ve sözleşme gerektiğini belirtiyor: https://nettefatura.isnet.net.tr/EFaturaSSS.html


## 30 Ekim 2026 — e-SMM sözleşmesi ve kontrollü test hazırlığı

- İşNet'in 14 Ekim tarihli “Web servis erişimi” yanıtı ve daha önce sağladığı WebServis arşivi yeniden incelendi. Arşivde ayrı `IsNet-ESMM-WebServiceArayuzDokumani` bulundu. Önceki “e-SMM sözleşmesi bulunamadı” değerlendirmesi artık güncel değildir.
- Sağlayıcının verdiği HTTPS InvoiceService uç noktasının güncel WSDL'sinde `SendESMM`, `SearchESMM` ve `SendESMMXml` doğrulandı. Yeni e-SMM istemcisi bu SOAP sözleşmesini kullanır; mobil REST belgeleri gönderim protokolü yerine kullanılmaz.
- `lib/invoicing/isnet-esmm-test.ts`: yalnız sabit İşNet TEST adresine çağrı yapabilir. Üretim adresi, canlı gönderim veya arka plan kesim işi içermez. Belge kimliği ve `ExternalDocumentNumber` kalıcı olmalıdır. Ağ hatasında otomatik yeniden gönderim yapılmaz; aynı harici kodla sorgulama gerekir. Sorgu farklı harici belge döndürürse sonuç kullanılamaz.
- Vergi oranları, matrahlar, makbuz numarası/seri ve alıcı bilgileri açıkça sağlanmalıdır; öğrenci paketinden veya dekonttan türetilmez. Tutarların satır/toplam tutarlılığı kontrol edilir; gerçek muhasebe profilinin doğrulanması yerine geçmez.
- Yerel testler gerçek firma/müşteri verisi kullanmaz ve sağlayıcıya ağ çağrısı yapmaz. SOAP sırası/ad alanları, XML kaçışları, yanıt kimliği, belirsiz teslim, hatalı XML ve yanlış belge eşleştirmesi kontrol edilir.
- Firma bilgisi içermeyen `HealthCheck` çağrısı HTTP 200 / true döndü. Bu sonuç firma yetkisi veya başarılı e-SMM kesimi değildir.
- Test firma VKN'siyle yapılacak sorgu otomatik onay denetimince açık kullanıcı onayı gerektiği için engellendi; başka bir yoldan tekrarlanmadı. Sağlayıcıda test belge gönderimi yapılmadı.
- Canlı salt okunur kontrol: 27 banka hareketi `review`, 1 belge talebi `waiting_customer/e_smm`, 0 bağlı sağlayıcı belgesi. İşNet yapılandırma anahtarları Vercel ortamında bulunmadı; diğer anahtarların değerleri açılmadı.

### Sonraki doğrulama sırası

1. Kullanıcının açık onayıyla, yalnız İşNet'in sağladığı test firma bilgileri ve test ortamı kullanılarak deneme e-SMM oluşturulur. Gerçek kursiyer/vergi bilgileri test ortamına taşınmaz. Test numara/seri ve örnek vergi profili sağlayıcının yetkili test bilgileriyle doğrulanır.
2. Aynı ETTN/harici kodla `SearchESMM` çalıştırılır. Sadece `SendESMM` Success sonucu yeterli değildir; belge durumları, test rapor kabulü ve PDF/XML birlikte doğrulanır.
3. İşNet'in e-postada istediği başarılı test belgesinin XML'si ve gerçek sabit çıkış IP'si, kullanıcı tarafından sağlayıcıya iletilir. Onaylı canlı uç nokta ve IP–firma yetkisi elde edilmeden üretim gönderimi açılmaz. Vercel'in rastgele fonksiyon IP'si sabit IP kabul edilmez.
4. Muhasebe hizmet/vergi profili ve yönetici içerik onayı, ödeme değişikliği kontrolü, atomik gönderim kilidi ve kalıcı sonucu saklama akışı tamamlanır. 27 banka hareketi kullanıcı incelemesinden geçmeden otomatik kursiyer/fatura alıcısı kabul edilmez.
5. İlk canlı belge ayrıca doğrulanır; ancak bundan sonra istenen otomasyon kapsamı açılır. Şu an otomatik/canlı makbuz kesimi açık değildir.


## 30 Ekim 2026 — kullanıcı onaylı gerçek test servisi denemesi

- Kullanıcı, İşNet'in kendi sağladığı test firma bilgileriyle yalnız test ortamında bir e-SMM oluşturulmasını ve PDF/XML/durum doğrulamasını açıkça onayladı. Önceki otomatik onay engeli bu kapsam için kullanıcı tarafından giderildi.
- İki test firmasının e-SMM yetkisi ve seri bilgisi `GetCompany` ile doğrulandı. Gönderimden önce harici kod ve numara için kayıt bulunmadığı kontrol edildi.
- İlk `SendESMM` isteği `CreatedDate` zorunluluğu nedeniyle Failed döndü. Yeniden sorguyla kayıt oluşmadığı doğrulandıktan sonra aynı ETTN/harici kod korundu ve zorunlu alan eklendi. İstemci artık oluşturulma tarihi ve gerçek takvim günü kontrolünü yerel olarak da yapıyor.
- Düzeltilen gönderim `Success`, sağlayıcı makbuz numarası ve aynı ETTN ile yanıtlandı. Sağlayıcı istekteki numara yerine kendi seri numarasını atadı. `ExternalESMMCode` ise boş döndü. Bu nedenle kabul yanıtı uçtan uca doğrulama sayılmadı.
- Harici kod ve ETTN ile `SearchESMM` kontrolleri `Success / 0 kayıt` döndü. Belgelenmiş aktif kayıt/hedef alanlarıyla kontroller de aynı sonucu verdi. `GetDocumentViewerLink` Outgoing/ESMM çağrısı `Success` ancak boş link döndürdü. Yeni bir makbuz gönderilmedi.
- GİB test rapor kabulü ve gerçek makbuz PDF/XML'si henüz doğrulanamadı; canlı/otomatik kesim açılmadı. İşNet'in aynı ETTN üzerinden kayıt/sorgu uyumluluğunu incelemesi gerekiyor.
- İstemciye belirsiz kabul yanıtında dönen ETTN/numarayı koruma ve yalnız ETTN ile salt okunur kurtarma sorgusu eklendi. Boş sorgu kesinleşmiş belge sayılmaz; farklı ETTN dönerse sonuç reddedilir. Otomatik tekrar kesim yoktur.
- Maskeleme yapılmış istek/servis yanıtları ve teknik destek mesajı taslağı ayrı test raporunda saklandı. Bu SOAP servis yanıtları GİB makbuz XML'si değildir. Gerçek firma/müşteri verileri, sağlayıcı test VKN'leri, portal bilgileri ve erişim anahtarları repoya eklenmedi.
