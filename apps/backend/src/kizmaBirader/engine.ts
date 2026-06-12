// Kızma Birader (Ludo) oyun motoru — saf fonksiyonlara yakın, sunucu-otorite.
// Kurallar: docs/kizma-birader/rules.md (otorite kaynak).
// İstemciye güvenilmez; tüm legal hamle üretimi ve uygulaması burada.

import type {
  KizmaColor,
  KizmaGameState,
  KizmaMove,
  PlayerState,
  Token,
} from './types';

// ── Sabitler (rules.md ile birebir) ─────────────────────────────────────────
export const COLORS_ORDER: KizmaColor[] = ['red', 'blue', 'yellow', 'white'];
export const TOKENS_PER_PLAYER = 4;
export const RING_SIZE = 52;
export const HOME_COLUMN_SIZE = 6;
export const GOAL_POS = 57; // 0..51 ring (52) + 52..57 home (6) -> son indeks 57
export const LAST_RING_POS = 51; // pos<=51 => ortak halka
export const EXIT_YARD_ROLL = 6;
export const EXTRA_TURN_ROLL = 6;
export const MAX_CONSECUTIVE_SIXES = 3;

export const START_OFFSET: Record<KizmaColor, number> = {
  red: 0,
  blue: 13,
  yellow: 26,
  white: 39,
};

export const SAFE_GLOBAL: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// ── Yardımcılar ──────────────────────────────────────────────────────────────

/** Bir taşın halka (ring) global hücresi; yard/home ise null. */
export function globalCell(color: KizmaColor, pos: number): number | null {
  if (pos < 0 || pos > LAST_RING_POS) return null;
  return (START_OFFSET[color] + pos) % RING_SIZE;
}

function cloneState(state: KizmaGameState): KizmaGameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      tokens: p.tokens.map((t) => ({ ...t })),
    })),
    activeColors: [...state.activeColors],
  };
}

function getPlayer(state: KizmaGameState, color: KizmaColor): PlayerState {
  const p = state.players.find((pl) => pl.color === color);
  if (!p) throw new Error(`Player not found: ${color}`);
  return p;
}

/** Belirli bir global halka hücresinde duran tüm taşlar (renk + tokenId). */
function tokensAtGlobal(
  state: KizmaGameState,
  globalIdx: number,
): { color: KizmaColor; tokenId: number }[] {
  const out: { color: KizmaColor; tokenId: number }[] = [];
  for (const p of state.players) {
    for (const t of p.tokens) {
      if (globalCell(p.color, t.pos) === globalIdx) out.push({ color: p.color, tokenId: t.id });
    }
  }
  return out;
}

/** Hedef halka hücresi rakip bir rengin 2+ taşıyla bloklanmış mı. */
function isBlockedForOpponent(
  state: KizmaGameState,
  globalIdx: number,
  movingColor: KizmaColor,
): boolean {
  const counts = new Map<KizmaColor, number>();
  for (const { color } of tokensAtGlobal(state, globalIdx)) {
    if (color === movingColor) continue;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  for (const c of counts.values()) if (c >= 2) return true;
  return false;
}

// ── Çekirdek API ──────────────────────────────────────────────────────────────

export function createInitialState(activeColors: KizmaColor[]): KizmaGameState {
  const ordered = COLORS_ORDER.filter((c) => activeColors.includes(c));
  const players: PlayerState[] = ordered.map((color) => ({
    color,
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, id): Token => ({ id, pos: -1 })),
    finished: false,
  }));
  return {
    players,
    activeColors: ordered,
    turn: ordered[0],
    dice: null,
    phase: 'rolling',
    winner: null,
    consecutiveSixes: 0,
    lastEvent: null,
  };
}

export function rollDice(): number {
  return Math.ceil(Math.random() * 6);
}

/** Sıradaki renk için tüm legal hamleler. phase 'moving' ve dice set olmalı. */
export function getLegalMoves(state: KizmaGameState): KizmaMove[] {
  if (state.phase !== 'moving' || state.dice == null) return [];
  const die = state.dice;
  const color = state.turn;
  const player = getPlayer(state, color);
  const moves: KizmaMove[] = [];

  for (const token of player.tokens) {
    // Yard'dan çıkış: yalnız 6
    if (token.pos === -1) {
      if (die !== EXIT_YARD_ROLL) continue;
      moves.push({ color, tokenId: token.id, die });
      continue;
    }

    // Bitmiş taş hareket etmez
    if (token.pos === GOAL_POS) continue;

    const newPos = token.pos + die;
    if (newPos > GOAL_POS) continue; // overshoot — tam sayı gerekir

    // Halkada kalıyorsa blok kontrolü; home sütununa giriyorsa kontrol yok (özel).
    // Güvenli karelerde blok kuralı işlemez: herkes inebilir, sınırsız taş durabilir.
    if (newPos <= LAST_RING_POS) {
      const g = globalCell(color, newPos)!;
      if (!SAFE_GLOBAL.has(g) && isBlockedForOpponent(state, g, color)) continue;
    }
    moves.push({ color, tokenId: token.id, die });
  }

  return moves;
}

/**
 * Zarı uygular. Üç-6 ve "hamle yok" durumlarında otomatik tur geçişi yapar.
 * Dönen state phase 'moving' ise oyuncunun bir hamle yapması beklenir.
 */
export function applyRoll(state: KizmaGameState, die: number): KizmaGameState {
  if (state.phase !== 'rolling' || state.winner) return state;

  const rolled: KizmaGameState = {
    ...cloneState(state),
    dice: die,
    consecutiveSixes: 0,
    phase: 'moving',
    lastEvent: null,
  };

  // Legal hamle yoksa tur geçer (6 olsa bile oynayacak taş yoksa)
  if (getLegalMoves(rolled).length === 0) {
    return nextTurn({ ...rolled, dice: null, phase: 'rolling', lastEvent: 'pass', consecutiveSixes: 0 });
  }

  return rolled;
}

/** Bir hamleyi uygular: kırma, eve giriş, bitiş, ekstra hak / tur geçişi. */
export function applyMove(state: KizmaGameState, move: KizmaMove): KizmaGameState {
  if (state.phase !== 'moving' || state.dice == null || state.winner) return state;

  const next = cloneState(state);
  const player = getPlayer(next, move.color);
  const token = player.tokens.find((t) => t.id === move.tokenId);
  if (!token) return state;

  const die = state.dice;
  const newPos = token.pos === -1 ? 0 : token.pos + die;

  let event: KizmaGameState['lastEvent'] = token.pos === -1 ? 'enter' : 'move';

  // Kırma — yalnız halka hücresinde ve güvenli değilse
  if (newPos <= LAST_RING_POS) {
    const g = globalCell(move.color, newPos)!;
    if (!SAFE_GLOBAL.has(g)) {
      for (const p of next.players) {
        if (p.color === move.color) continue;
        for (const t of p.tokens) {
          if (globalCell(p.color, t.pos) === g) {
            t.pos = -1; // yard'a dön
            event = 'capture';
          }
        }
      }
    }
  }

  token.pos = newPos;
  if (newPos === GOAL_POS && event !== 'capture') event = 'finish';

  player.finished = player.tokens.every((t) => t.pos === GOAL_POS);

  // Kazanan
  if (player.finished) {
    return { ...next, dice: null, phase: 'ended', winner: move.color, lastEvent: 'finish' };
  }

  // 6, kırma veya eve giriş → ekstra hak; değilse sıra geçer
  const getsExtraTurn = die === EXTRA_TURN_ROLL || event === 'capture' || event === 'finish';
  if (getsExtraTurn) {
    return { ...next, dice: null, phase: 'rolling', lastEvent: event };
  }

  return nextTurn({ ...next, dice: null, lastEvent: event });
}

/** Sıradaki aktif renge geçer. */
export function nextTurn(state: KizmaGameState): KizmaGameState {
  if (state.winner) return state;
  const order = state.activeColors;
  const idx = order.indexOf(state.turn);
  const nextColor = order[(idx + 1) % order.length];
  return {
    ...state,
    turn: nextColor,
    phase: 'rolling',
    dice: null,
    consecutiveSixes: 0,
  };
}

export function checkWinner(state: KizmaGameState): KizmaColor | null {
  for (const p of state.players) {
    if (p.tokens.every((t) => t.pos === GOAL_POS)) return p.color;
  }
  return null;
}
