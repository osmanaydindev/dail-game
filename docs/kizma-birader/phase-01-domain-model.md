# Phase 01 — Domain Model (Tipler)

## Amaç
Frontend ve backend arasında type drift olmadan kullanılacak Kızma Birader
tiplerini tanımlamak. Engine state şeklini netleştirmek.

## Değiştirilecek / Oluşturulacak dosyalar
- `apps/backend/src/kizmaBirader/types.ts` (engine + room tipleri)
- `apps/frontend/src/components/kizma-birader/types.ts` (FE ayna tipleri)
- (Opsiyonel) `packages/types/src/index.ts` — paylaşımlı tipler gerekiyorsa.
  Karar: Kızma Birader tipleri oyun-içi ve socket-içi olduğundan, Tavla deseniyle
  tutarlı kalmak için **her tarafta ayna `types.ts`** tutulur (Tavla da böyle yapıyor).
  `packages/types`'a global API tipleri girmediği için orayı şişirmiyoruz.

## Tipler

```ts
export type KizmaColor = 'red' | 'blue' | 'yellow' | 'white';

export interface Token {
  id: number;            // 0..3 (oyuncu içi taş indeksi)
  pos: number;           // -1 yard | 0..51 ring | 52..57 home (57 = goal)
}

export interface PlayerState {
  color: KizmaColor;
  tokens: Token[];       // 4 taş
  finished: boolean;     // 4 taş da goal'da mı
}

export interface KizmaMove {
  color: KizmaColor;
  tokenId: number;       // hangi taş
  die: number;           // kullanılan zar (1..6)
}

export interface KizmaGameState {
  players: PlayerState[];        // sadece AKTİF renkler, tur sırasına göre
  activeColors: KizmaColor[];    // tur döngüsü sırası (3 veya 4)
  turn: KizmaColor;              // sırası gelen renk
  dice: number | null;           // atılan son zar (null = henüz atılmadı)
  phase: 'rolling' | 'moving' | 'ended';
  winner: KizmaColor | null;
  consecutiveSixes: number;      // üç 6 kuralı için sayaç
  lastEvent?: 'move' | 'capture' | 'finish' | 'pass' | 'enter' | null;
}
```

- `dice` tek zar tutar; Ludo'da tek zar atılır (Tavla'daki iki zardan farklı).
- `movesLeft` yok; zar atılır, bir hamle yapılır, sonra (6 değilse) sıra geçer.

## Kabul kriterleri
- Backend ve frontend tipleri birebir uyumlu (alan adları/şekil aynı).
- `KizmaGameState` engine'in ürettiği tüm bilgiyi (highlight + UI için) taşır.

## Manuel test adımları
- `tsc --noEmit` ile tip uyumu (sonraki fazlarda import edilince doğrulanır).

## Bilinen riskler
- FE/BE ayna tip kopyası drift riski taşır; değişiklikte iki dosya birlikte
  güncellenmeli. Bu, Tavla'nın da kullandığı kabul edilmiş bir desen.
