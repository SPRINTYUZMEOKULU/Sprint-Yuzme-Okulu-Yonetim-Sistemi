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

Bu çalışma SOAP gönderim istemcisi içermez; banka hareketleri aşağıdaki kontrollü Excel aktarımıyla alınır. IBAN hareketlerini otomatik almak ayrıca VakıfBank bağlantısı gerektirir. Otomatik öğrenci eşleştirmesi yalnızca isim/tutarla kesin kabul edilmemelidir.

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
