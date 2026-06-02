# Phase 04 — Frontend Lobby

## Amaç
Route, socket helper, navbar linki ve lobby ekranını kurmak. Auth olmayan
kullanıcı `/login`'e gider (Tavla page deseni).

## Değiştirilecek / Oluşturulacak dosyalar
- `apps/frontend/src/app/[locale]/kizma-birader/page.tsx` (yeni route)
- `apps/frontend/src/components/kizma-birader/KizmaBiraderGame.tsx` (ana bileşen)
- `apps/frontend/src/components/kizma-birader/types.ts` (ayna tipler)
- `apps/frontend/src/lib/socket.ts` (`createKizmaBiraderSocket()` eklenir)
- `apps/frontend/src/components/layout/Navbar.tsx` ("Kızma Birader" linki)

## Lobby gereksinimleri
- Oda oluştur / oda koduyla katıl.
- Oyuncu listesi (isim + connected durumu).
- Renk seçimi: red/blue/yellow/white — boş/seçili/dolu durumları açık görünür.
  Renk **otomatik atanmaz**; dolu renk seçilemez.
- "Hazır" butonu (renk seçilmeden pasif).
- Host için "Oyunu Başlat" (≥3 hazır oyuncu yoksa pasif).
- 3/4 oyuncu durumu görünür.

## Kabul kriterleri
- `npm run build --workspace=apps/frontend` hatasız.
- `/kizma-birader` açılır; auth yoksa `/login`.
- Lobby socket eventleriyle canlı güncellenir.
- `@/lib/navigation` kullanılır (locale-aware). `useColorMode` provider'dan.

## Manuel test adımları
- Login olmadan `/kizma-birader` → `/login`.
- Login sonrası oda oluştur, kodu başka sekmede gir, renk seç, ready, start.
- Aynı rengi iki kişi seçmeye çalış → engellenir.

## Bilinen riskler
- Socket auth token (access token) süresi: bağlantı sırasında geçerli olmalı
  (Tavla ile aynı davranış).
