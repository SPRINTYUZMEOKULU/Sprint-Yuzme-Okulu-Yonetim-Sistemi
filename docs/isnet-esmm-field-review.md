# İşNet e-SMM ekran karşılaştırması — 13 Kasım 2026

Kullanıcının sağladığı mobil ekranlar şirket seçimi, e-SMM oluşturma, alıcı seçimi/yeni alıcı ve hizmet satırı hazırlığını gösteriyor. Sonradan paylaşılan düzenlenmiş makbuz tutar karşılaştırmasını da mümkün kıldı. Gerçek makbuz düzenlenmedi; yalnızca sağlayıcının sabit test ortamında sentetik verilerle bir test gönderimi yapıldı. Şirket/adres defteri kişisel verileri bu dokümana kopyalanmadı.

| Ekran alanı | SprintOS / test SOAP alanı | Sonuç |
|---|---|---|
| Şirket | CompanyTaxCode | Seçili şirket adı, şirket VKN'si veya web servis yetkisinin doğrulaması değildir. |
| Gerçek / tüzel kişi | recipient_type; ReceiverTaxCode ve ReceiverName | Güvenli müşteri formunda ayrı kişi tipi, ad/unvan ve TCKN/VKN mevcut. |
| İl, ilçe | city → CityName; district → TownName | Form ve kayıt katmanına ayrı alanlar eklendi. Şubeden veya serbest adresten tahmin edilmez. |
| Mahalle/sokak, bina | address → BoulevardAveneuStreetName | Açık adres alanı korunuyor; bina/kapı bilgisi için açıklama eklendi. |
| Posta kodu | postal_code | İsteğe bağlı toplanır; mevcut test SOAP isteğine desteklenmeyen alan eklenmedi. |
| Vergi dairesi, e-posta, telefon | tax_office, email, phone | Mevcut toplama akışı korunuyor. Dolu e-posta alanı sunucuda da doğrulanıyor. |
| Düzenleme tarihi / saati | DocumentDate ve CreatedDate | Test istemcisi Türkiye saatini ve geçerli takvim tarihini doğruluyor. |
| Para birimi | CurrencyCode | Mevcut test istemcisi TRY ile sınırlı; yeni para birimi varsayılmadı. |
| Hizmet ve brüt/net | ProductName, ProductDescription ve açık tutar alanları | Düzenlenmiş örnekte 4.000,00 TL tahsilat, 3.333,33 TL brüt/net hizmet bedeli ve 666,67 TL KDV bulunuyor. Tahsilat ile KDV hariç bedel ayrı seçilmeli. |
| KDV, GV stopajı, tevkifat | VatTax*, StoppageTax*, WitholdingTax* | Düzenlenmiş örnekte KDV %20, stopaj ve tevkifat %0. Bu örnek tüm alıcı/hizmetler için otomatik vergi profili olarak uygulanmaz. |
| Banka | Ödeme eşleştirmesi | Ekrandaki banka seçimi, tahsilat doğrulaması olarak kullanılmaz. |
| Not | Note | Test istemcisinde mevcut. |
| Elektronik / kağıt | SendingType | Mevcut test isteği ELEKTRONIK; bu inceleme kağıt gönderim desteği eklemez. |

Önceki kayıtlar boş il/ilçe ile korunur; tamamlanmış talepler yeniden açılmaz, ödeme eşleştirme mantığı değiştirilmez. Yeni formlar il/ilçe ister. Fatura Merkezi tamamlanmış müşteri bilgisi bulunan fakat yapılandırılmış adresi eksik eski talepleri inceleme için işaretler; TCKN/VKN ve açık adres listeye taşınmaz.

## Hâlâ gereken doğrulamalar

- Örneğin sıfır kesintili hesabı `/fatura-merkezi/esmm-hazirlik` ekranında kontrol edilebilir. Ekran kaydetmez veya belge göndermez. Kuruş hesabı ve SOAP uyumu test edildi; sıfır olmayan kesintiler destekleniyormuş gibi hesaplanmaz.
- Sağlayıcının 12 Kasım yanıtına göre eski test belgesi bakım sırasında silinmiş; test ortamı yeniden hazır. Bu nedenle 13 Kasım'da yalnızca bir yeni sentetik test gönderildi; aynı kimlik kalıcı tutuldu, otomatik tekrar gönderim yapılmadı. Durum ve dosyalar `SearchESMM` ile, `IsPDFIncluded=true` / `IsXMLIncluded=true` kullanılarak takip edilir. Görüntüleme linki yöntemi e-SMM desteklemiyor.
- Canlı yetkilendirme için yeni testin `GibRaporuKabulEtti` durumuna ulaşması, PDF/XML kontrolü ve sağlayıcıya statik çıkış IP'si / şirket yetkisinin tanımlanması gerekiyor. Kesin test sonucu entegrasyon notunda kayıtlıdır.
- Canlı şirket VKN / seri / web servis yetkisi ve yönetici onaylı gönderim kilidi tamamlanmadan otomatik kesim açılmaz.

Mobil adres defterinde görünen `&#9;` metni sağlayıcının ekranında yer alıyor. Bu çalışma İşNet'in mobil uygulamasını veya adres defterini değiştirmez; isimlere bakarak alıcı birleştirme yapılmaz.
