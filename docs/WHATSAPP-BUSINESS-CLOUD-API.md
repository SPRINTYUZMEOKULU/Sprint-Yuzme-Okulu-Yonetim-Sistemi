# SPRİNT WhatsApp Business Cloud API kurulumu

Hazır Mesajlar / Toplu İletişim Merkezi iki modda çalışır:

1. **Gönderim Kuyruğu:** Ek kurulum gerektirmez. Her alıcı için WhatsApp mesajını sırayla açar; kullanıcı WhatsApp içinde gönderimi onaylar.
2. **WhatsApp Business Cloud API:** Meta üzerinden sunucudan gerçek toplu gönderim yapar.

## Vercel ortam değişkenleri

Aşağıdaki değerler yalnızca Vercel sunucu ortamında tutulmalıdır. GitHub'a gerçek anahtar yazılmamalıdır.

- `WHATSAPP_ACCESS_TOKEN` — Meta WhatsApp Business kalıcı erişim anahtarı
- `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp Business telefon numarası ID'si
- `WHATSAPP_GRAPH_VERSION` — İsteğe bağlı; Meta Graph API sürümü. Ayarlanmazsa uygulama `v23.0` kullanır.

Değişkenler Production, Preview ve ihtiyaç varsa Development ortamlarına tanımlandıktan sonra Vercel deployment yeniden başlatılmalıdır.

## Meta tarafında gerekenler

- Meta Business hesabı
- WhatsApp Business Account (WABA)
- Cloud API'ye bağlı işletme telefon numarası
- Mesaj gönderme yetkisine sahip kalıcı system-user token
- Kursiyer/velilerden WhatsApp iletişim izni ve güncel telefon numarası
- İşletme tarafından başlatılan görüşmelerde Meta tarafından onaylanmış WhatsApp message template'leri

## Önemli WhatsApp kuralı

`wa.me` veya WhatsApp Web bağlantısı bir web sayfasının mesajı arka planda sessizce göndermesine izin vermez. Bu yüzden API yapılandırılmadığında SprintOS güvenli **Gönderim Kuyruğu** kullanır.

Cloud API'de serbest metin mesajları yalnızca Meta'nın izin verdiği müşteri hizmeti konuşma penceresinde gönderilebilir. Bu pencere dışında işletme tarafından başlatılan mesajlar için onaylı WhatsApp template kullanılmalıdır. API hata verirse Mesaj Merkezi kaç gönderimin başarılı/başarısız olduğunu gösterir.

## SprintOS endpoint

- `POST /api/whatsapp/bulk`
- Maksimum 200 alıcı / istek
- Telefonlar Türkiye formatına normalize edilir (`90...`)
- Görsel URL verilmişse önce görsel, ardından mesaj metni gönderilir
- Yetki: owner, admin, branch_manager, registration_staff

## Sonraki üretim aşaması

Meta'da onaylanmış şablon adları belli olduğunda SprintOS merkezi mesaj kataloğundaki durumlar (`registration`, `renewal`, `payment`, `pool_closed`, `group_transfer`, `gift` vb.) Meta template adlarıyla eşleştirilmeli; müşteri hizmeti penceresi dışındaki toplu gönderimler otomatik olarak template moduna geçirilmelidir.
