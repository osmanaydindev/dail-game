# Phase 06 — Mobile / Landscape Polish

## Amaç
Hem portrait hem landscape'te rahat oynanır deneyim. Özellikle mobil yatay modda
immersive (header gizli, tam ekran hissi) düzen. Touch hedefleri rahat.

## Değiştirilecek / Oluşturulacak dosyalar
- `apps/frontend/src/app/globals.css` (Kızma için `.kb-*` immersive landscape kuralları)
- `apps/frontend/src/app/[locale]/kizma-birader/page.tsx` (`AppShell noPadding hideNavOnLandscape`)
- `apps/frontend/src/components/kizma-birader/KizmaBiraderGame.tsx` (responsive sınıflar)

## Yaklaşım (Tavla deseninden faydalan)
- `AppShell`'in `noPadding` + `hideNavOnLandscape` proplarını kullan.
- Board kare olarak `min(vw, vh)` mantığıyla ölçeklenir; SVG `viewBox` sabit,
  CSS ile container boyutlanır.
- Landscape (`max-height: 500px`): header gizli, board dikey alanı doldurur,
  zar/aksiyon butonları sağ marja alınır (Tavla `.tavla-actions` benzeri `.kb-actions`).
- Portrait: board üstte, kontrol/oyuncu bilgisi altta; taşlar/kareler çok küçülmez.

## Kabul kriterleri
- `npm run build --workspace=apps/frontend` hatasız.
- Mobil portrait kullanılabilir; landscape rahat oynanır.
- Butonlar/metinler board üstüne çakışmaz.
- Tavla'nın mevcut landscape davranışı bozulmaz (sadece yeni `.kb-*` sınıfları).

## Manuel test adımları
- DevTools device toolbar: iPhone/Android portrait + landscape.
- Gerçek telefonda yatay çevirip oyna; zar butonu erişilebilir mi.
- Beyaz taş koyu/açık temada görünür mü.

## Bilinen riskler
- `100dvh` iOS Safari kenar durumları (Tavla'da çözülmüş desen kullanılacak).
