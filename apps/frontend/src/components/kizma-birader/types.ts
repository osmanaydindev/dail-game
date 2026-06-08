// Kızma Birader (Ludo) — frontend tipleri.
// apps/backend/src/kizmaBirader/types.ts ile birebir aynı tutulmalı.

export type KizmaColor = 'red' | 'blue' | 'yellow' | 'white';

export interface Token {
  id: number; // 0..3
  pos: number; // -1 yard | 0..51 ring | 52..57 home (57 = goal)
}

export interface PlayerState {
  color: KizmaColor;
  tokens: Token[];
  finished: boolean;
}

export interface KizmaMove {
  color: KizmaColor;
  tokenId: number;
  die: number;
}

export type KizmaPhase = 'rolling' | 'moving' | 'ended';
export type KizmaEvent = 'move' | 'capture' | 'finish' | 'pass' | 'enter' | null;

export interface KizmaGameState {
  players: PlayerState[];
  activeColors: KizmaColor[];
  turn: KizmaColor;
  dice: number | null;
  phase: KizmaPhase;
  winner: KizmaColor | null;
  consecutiveSixes: number;
  lastEvent: KizmaEvent;
}

// ── Lobby & socket payload tipleri ──────────────────────────────────────────
export interface LobbyPlayer {
  displayName: string;
  color: KizmaColor | null;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface LobbyPayload {
  code: string;
  players: LobbyPlayer[];
  takenColors: KizmaColor[];
  readyCount: number;
  canStart: boolean;
}

export interface GamePlayerInfo {
  displayName: string;
  color: KizmaColor | null;
}

export const KIZMA_COLORS: KizmaColor[] = ['red', 'blue', 'yellow', 'white'];

export const COLOR_HEX: Record<KizmaColor, string> = {
  red: '#e53e3e',
  blue: '#3182ce',
  yellow: '#f6c244',
  white: '#38a169',
};

export const COLOR_LABEL_TR: Record<KizmaColor, string> = {
  red: 'Kırmızı',
  blue: 'Mavi',
  yellow: 'Sarı',
  white: 'Yeşil',
};
