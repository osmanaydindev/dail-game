# Phase 07 — Tests & Validation

## Amaç
Tüm build/typecheck'leri çalıştırmak, manuel test senaryolarını doğrulamak ve
mevcut oyunların (Tavla/Wordle/Parolla) bozulmadığını teyit etmek.

## Değiştirilecek / Oluşturulacak dosyalar
- `docs/kizma-birader/manual-test.md` (3 ve 4 oyunculu senaryolar)
- (gerekiyorsa) küçük düzeltmeler

## Çalıştırılacaklar
```
npm run build --workspace=apps/backend
npm run build --workspace=apps/frontend
npm run build            # kök (varsa)
```
TypeScript hatası bırakılmaz.

## Manuel test senaryoları (özet — detay manual-test.md)
- **4 oyunculu:** 4 sekme, her biri farklı renk, start, tam oyun, kazanan.
- **3 oyunculu:** 3 sekme, bir renk pasif; board dengeli; tur döngüsü pasifi atlar.
- **Renk:** otomatik atanmaz; dolu renk seçilemez; renksiz ready olunamaz.
- **Doğrulama:** geçersiz hamle backend reddeder.
- **Rejoin:** sekme yenile → state geri gelir.
- **Mobil:** portrait kullanılabilir, landscape rahat.

## Kabul kriterleri
- Tüm build'ler yeşil.
- Tavla/Wordle/Parolla sayfaları çalışır (regresyon yok).
- Socket auth token ile çalışır.
- Tüm üst-seviye kabul kriterleri (görev tanımı) karşılanır.

## Bilinen riskler
- Çok-sekme aynı kullanıcı: aynı userId ile birden çok oyuncu ayırt edilmeli
  (socket.id bazlı oyuncu kimliği; test ederken farklı kullanıcı önerilir).
