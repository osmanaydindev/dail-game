// Kızma Birader (Ludo) — paylaşılan tipler (backend).
// Frontend tarafında apps/frontend/src/components/kizma-birader/types.ts ile
// birebir aynı tutulmalı (Tavla deseni). Değişiklikte iki dosya birlikte güncellenir.

export type KizmaColor = 'red' | 'blue' | 'yellow' | 'white';

export interface Token {
  id: number; // 0..3 (oyuncu içi taş indeksi)
  pos: number; // -1 yard | 0..51 ring | 52..57 home (57 = goal/bitiş)
}

export interface PlayerState {
  color: KizmaColor;
  tokens: Token[]; // 4 taş
  finished: boolean; // 4 taş da goal'da mı
}

export interface KizmaMove {
  color: KizmaColor;
  tokenId: number; // hangi taş
  die: number; // kullanılan zar (1..6)
}

export type KizmaPhase = 'rolling' | 'moving' | 'ended';
export type KizmaEvent = 'move' | 'capture' | 'finish' | 'pass' | 'enter' | null;

export interface KizmaGameState {
  players: PlayerState[]; // sadece AKTİF renkler, tur sırasına göre
  activeColors: KizmaColor[]; // tur döngüsü sırası (3 veya 4)
  turn: KizmaColor; // sırası gelen renk
  dice: number | null; // atılan son zar (null = henüz atılmadı)
  phase: KizmaPhase;
  winner: KizmaColor | null;
  consecutiveSixes: number; // üç 6 kuralı için sayaç
  lastEvent: KizmaEvent;
}
