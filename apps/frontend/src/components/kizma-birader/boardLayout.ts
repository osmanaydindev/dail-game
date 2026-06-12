// Kızma Birader board geometrisi — 15×15 grid (col=x, row=y, origin sol-üst).
// Engine global ring indeksleri (START_OFFSET ile) buradaki koordinatlara eşlenir.
// Geometri, her rengin ev girişinin (pos 51 → pos 52) görsel olarak bitişik
// olacağı şekilde hesaplanmıştır.

import type { KizmaColor } from './types';

export const GRID = 15;

// Engine ile birebir aynı (apps/backend/src/kizmaBirader/engine.ts)
export const START_OFFSET: Record<KizmaColor, number> = {
  red: 0,
  blue: 13,
  yellow: 26,
  white: 39,
};
export const SAFE_GLOBAL: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const GOAL_POS = 57;
export const LAST_RING_POS = 51;

export type Coord = { x: number; y: number };

// Saat yönünde ham halka yolu (52 hücre). Sol kolun üst hücresinden başlar.
const ORIGINAL_PATH: Coord[] = [
  { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, // 0-4
  { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 }, // 5-10
  { x: 7, y: 0 }, { x: 8, y: 0 }, // 11-12
  { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }, // 13-17
  { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 }, // 18-23
  { x: 14, y: 7 }, { x: 14, y: 8 }, // 24-25
  { x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }, { x: 10, y: 8 }, { x: 9, y: 8 }, // 26-30
  { x: 8, y: 9 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 8, y: 12 }, { x: 8, y: 13 }, { x: 8, y: 14 }, // 31-36
  { x: 7, y: 14 }, { x: 6, y: 14 }, // 37-38
  { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 6, y: 10 }, { x: 6, y: 9 }, // 39-43
  { x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 8 }, { x: 1, y: 8 }, { x: 0, y: 8 }, // 44-49
  { x: 0, y: 7 }, { x: 0, y: 6 }, // 50-51
];

// Engine global indeksine göre döndürülmüş halka: RING_COORDS[0] = kırmızı start.
export const RING_COORDS: Coord[] = Array.from({ length: 52 }, (_, g) =>
  ORIGINAL_PATH[(g + 51) % 52],
);

// Her rengin 6 hücrelik ev sütunu (pos 52..57; 57 = goal, merkeze en yakın).
export const HOME_PATH: Record<KizmaColor, Coord[]> = {
  red: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }],
  blue: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }],
  yellow: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }],
  white: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }],
};

// Yard (başlangıç köşesi) — 4 taş slotu. Çeyrek merkezinden ±1.05:
// köşe slot merkezi 1.485 uzakta + slot yarıçapı 0.55 = 2.03 < beyaz daire 2.45,
// yani slotlar (ve taşlar) dairenin içinde kalır.
export const YARD_SLOTS: Record<KizmaColor, Coord[]> = {
  red: [{ x: 1.95, y: 1.95 }, { x: 4.05, y: 1.95 }, { x: 1.95, y: 4.05 }, { x: 4.05, y: 4.05 }],
  blue: [{ x: 10.95, y: 1.95 }, { x: 13.05, y: 1.95 }, { x: 10.95, y: 4.05 }, { x: 13.05, y: 4.05 }],
  yellow: [{ x: 10.95, y: 10.95 }, { x: 13.05, y: 10.95 }, { x: 10.95, y: 13.05 }, { x: 13.05, y: 13.05 }],
  white: [{ x: 1.95, y: 10.95 }, { x: 4.05, y: 10.95 }, { x: 1.95, y: 13.05 }, { x: 4.05, y: 13.05 }],
};

// Köşe yard kutuları (6×6) ve renk eşlemesi.
export const YARD_BOX: Record<KizmaColor, { x: number; y: number; w: number; h: number }> = {
  red: { x: 0, y: 0, w: 6, h: 6 },
  blue: { x: 9, y: 0, w: 6, h: 6 },
  yellow: { x: 9, y: 9, w: 6, h: 6 },
  white: { x: 0, y: 9, w: 6, h: 6 },
};

/** Bir taşın board koordinatı (hücre MERKEZİ). pos -1 ise verilen yard slotu.
 *  YARD_SLOTS zaten merkez (ör. 1.5); ring/home origin olduğu için +0.5 eklenir. */
export function posToCoord(color: KizmaColor, pos: number, yardSlot = 0): Coord {
  if (pos < 0) return YARD_SLOTS[color][Math.min(yardSlot, 3)];
  const c = pos <= LAST_RING_POS
    ? RING_COORDS[(START_OFFSET[color] + pos) % 52]
    : HOME_PATH[color][pos - 52];
  return { x: c.x + 0.5, y: c.y + 0.5 };
}

/** Halka hücresinin global indeksi güvenli mi (yıldız/start). */
export function isSafeRing(color: KizmaColor, pos: number): boolean {
  if (pos < 0 || pos > LAST_RING_POS) return false;
  return SAFE_GLOBAL.has((START_OFFSET[color] + pos) % 52);
}
