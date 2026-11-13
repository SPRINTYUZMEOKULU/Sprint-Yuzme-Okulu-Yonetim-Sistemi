# İşNet e-SMM ekran karşılaştırması — 13 Kasım 2026

Kullanıcının sağladığı mobil ekranlar şirket seçimi, e-SMM oluşturma, alıcı seçimi/yeni alıcı ve hizmet satırı hazırlığını gösteriyor. Gerçek makbuz veya yeni test gönderimi yapılmadı. Şirket/adres defteri kişisel verileri bu dokümana kopyalanmadı.

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
| Hizmet ve brüt/net | ProductName, ProductDescription ve açık tutar alanları | Görsellerde hizmet seçilmemiş. Paket ücretinden vergi profili oluşturulmaz. |
| KDV, GV stopajı, tevkifat | VatTax*, StoppageTax*, WitholdingTax* | Etiketlerin görünmesi, uygulanacak oranların seçildiğini göstermez. Muhasebe profili hâlâ doğrulanmalı. |
| Banka | Ödeme eşleştirmesi | Ekrandaki banka seçimi, tahsilat doğrulaması olarak kullanılmaz. |
| Not | Note | Test istemcisinde mevcut. |
| Elektronik / kağıt | SendingType | Mevcut test isteği ELEKTRONIK; bu inceleme kağıt gönderim desteği eklemez. |

Önceki kayıtlar boş il/ilçe ile korunur; tamamlanmış talepler yeniden açılmaz, ödeme eşleştirme mantığı değiştirilmez. Yeni formlar il/ilçe ister. Fatura Merkezi tamamlanmış müşteri bilgisi bulunan fakat yapılandırılmış adresi eksik eski talepleri inceleme için işaretler; TCKN/VKN ve açık adres listeye taşınmaz.

## Hâlâ gereken doğrulamalar

- Gerçekte kullanılan hizmet adı, brüt/net tercihi, KDV, stopaj ve varsa tevkifat profili: dolu hizmet özeti veya mevcut düzenlenmiş bir makbuzdan incelenmeli; boş ürün ekranları yeterli değil.
- 30 Ekim testinde kabul yanıtı alınan aynı ETTN/harici kodun SearchESMM sonucu, belge durumu ve PDF/XML çıktısı hâlâ doğrulanmalı. Yeni kimlikle tekrar gönderim yapılmaz.
- Canlı şirket VKN / seri / web servis yetkisi ve yönetici onaylı gönderim kilidi tamamlanmadan otomatik kesim açılmaz.

Mobil adres defterinde görünen `&#9;` metni sağlayıcının ekranında yer alıyor. Bu çalışma İşNet'in mobil uygulamasını veya adres defterini değiştirmez; isimlere bakarak alıcı birleştirme yapılmaz.
