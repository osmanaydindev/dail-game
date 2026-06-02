# Phase 00 — Araştırma & Kurallar

## Amaç
Kızma Birader (Ludo) kurallarını netleştirip tek otorite kaynak haline getirmek.
Mevcut Tavla websocket/oda mimarisini referans alıp Kızma Birader'in bu mimariye
nasıl oturacağını kararlaştırmak.

## Değiştirilecek / Oluşturulacak dosyalar
- `docs/kizma-birader/rules.md` (otorite kural seti) — **oluşturuldu**
- `docs/kizma-birader/phase-*.md` (bu plan dosyaları) — **oluşturuldu**

## Kararlar
- Renkler: `red, blue, yellow, white`. Otomatik atama yok.
- 3 ve 4 oyuncu. Tur sırası sabit renk döngüsü, pasif renk atlanır.
- pos modeli: `-1` yard, `0..51` ring, `52..57` home, `57` goal.
- Güvenli kareler: `{0,8,13,21,26,34,39,47}`.
- Kendi taşları stack olabilir; 2+ taş = aşılmaz/kırılmaz blok.
- 6 → evden çıkış + ekstra hak; üç 6 → tur yanar.
- Mimari: Tek Socket.IO `io` server, Kızma Birader **`/kizma` namespace**'inde.
  Tavla default namespace'te kalır (dokunulmaz). `attachTavlaSocket` yalnızca
  `io` instance'ını döndürecek şekilde genişletilir (davranış değişmez).

## Kabul kriterleri
- `rules.md` tüm kenar durumları (overshoot, blok, güvenli kare, üç 6) kapsar.
- Plan dosyaları her fazın amaç/dosya/kabul/test/risk bölümlerini içerir.

## Manuel test adımları
- Yok (dokümantasyon fazı). Sonraki fazlar bu kurallara göre doğrulanır.

## Bilinen riskler
- Ludo'da "kaç hücre" sayımı kaynaktan kaynağa ±1 değişir. Burada **iç tutarlılık**
  esas alındı: ring relative `0..51`, home `52..57`. Geometrik kısıt: ev girişi
  relative `51 = (START-1)` hücresinde; taş kendi start'ına tekrar basmaz.
