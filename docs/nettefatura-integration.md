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

Bu değişiklik SOAP gönderim istemcisi veya banka hareketi içe aktarıcısı içermez. IBAN hareketlerini otomatik almak ayrıca VakıfBank bağlantısı gerektirir. Otomatik öğrenci eşleştirmesi yalnızca isim/tutarla kesin kabul edilmemelidir.
