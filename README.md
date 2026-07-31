# SprintOS v3.1

Sprint Yüzme Okulu için Next.js + Supabase yönetim sistemi.

## Kurulum
1. `.env.example` dosyasını `.env.local` olarak kopyalayın.
2. Supabase URL ve anon key değerlerini girin.
3. `npm install`
4. `npm run dev`

## Veli erişimi
`profiles.role = guardian` olan kullanıcılar veli rolüyle giriş yapar. Veli; yalnızca kendisine bağlı öğrencilerin devam, gelişim, duyuru ve ödeme bilgilerini görebilir. RLS politikaları `sql/003_guardian_portal.sql` dosyasındadır.
