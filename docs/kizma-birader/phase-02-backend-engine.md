# Phase 02 — Backend Engine

## Amaç
Saf fonksiyonlara yakın, tamamen sunucu-tarafı doğrulanan oyun motorunu yazmak.
İstemciye güvenilmez; tüm legal hamle üretimi ve uygulaması burada.

## Değiştirilecek / Oluşturulacak dosyalar
- `apps/backend/src/kizmaBirader/engine.ts`
- `apps/backend/src/kizmaBirader/types.ts`

## Fonksiyonlar (imza)
```ts
createInitialState(activeColors: KizmaColor[]): KizmaGameState
rollDice(): number                                  // 1..6
applyRoll(state, die): KizmaGameState               // dice set + phase geçişi
getLegalMoves(state): KizmaMove[]                    // sıradaki renk için
applyMove(state, move): KizmaGameState               // kırma + bitiş + ev
nextTurn(state): KizmaGameState                      // sıradaki aktif renge geç
checkWinner(state): KizmaColor | null
```

## Mantık özeti
- `createInitialState`: aktif renkleri `COLORS_ORDER`'a göre sıralar; her oyuncuya
  4 taş (`pos=-1`); ilk turn = ilk aktif renk; phase `rolling`.
- `applyRoll`: `dice=die`, üst üste 6 sayacını günceller. Üç 6 → hamle yok, sıra
  geçer (consecutiveSixes sıfırlanır). Aksi halde `phase='moving'`. Eğer hiç legal
  hamle yoksa otomatik `nextTurn` (6 ise ve hamle yoksa da tur geçer).
- `getLegalMoves`:
  - yard taşı: yalnız `die===6` ise start hücresine (blok kontrolü).
  - ring/home taşı: `pos+die <= 57`, hedef blok değilse, kendi 2+ yığınına/araya
    takılmıyorsa legal.
  - hedef ring hücresi rakip 2+ taş (blok) içeriyorsa illegal.
- `applyMove`: taşı taşır; ring hedefinde rakip tek taş + güvenli değilse kırar
  (rakip taş `pos=-1`). `pos===57` → o taş bitti. Kullanılan zar 6 ise ekstra hak
  (turn değişmez, phase `rolling`, dice=null). Değilse `nextTurn`.
- `checkWinner`: 4 taşı da `pos===57` olan ilk renk.

## Kabul kriterleri
- `npm run build --workspace=apps/backend` hatasız.
- Engine deterministik (rollDice hariç saf). Aynı state+move → aynı sonuç.
- Geçersiz hamle `getLegalMoves` içinde yer almaz.

## Manuel test adımları
- Geçici bir node script veya REPL ile:
  - 4 renkli initial state üret, 6 at → bir taş çıkar, legal moves doğru mu.
  - Overshoot: home'a yakın taşta `pos+die>57` → move listesinde yok.
  - Capture: rakip tek taş olan güvensiz kareye gel → rakip `pos=-1`.
  - Blok: rakip 2 taşlı kareye gelme → illegal.
  - 4 taş goal → checkWinner doğru renk.

## Bilinen riskler
- Blok/kırma kenar durumları (güvenli kare + blok kesişimi) dikkat ister.
- Home sütununda kırma olmamalı; ring/home ayrımı `pos<=51` ile yapılır.
