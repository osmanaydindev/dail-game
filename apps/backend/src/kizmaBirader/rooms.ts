// Kızma Birader — bellek-içi oda yönetimi (Tavla deseniyle tutarlı).

import type { KizmaColor, KizmaGameState } from './types';

export interface KizmaPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  socketId: string;
  color: KizmaColor | null;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  // Odaya ilk giriş anı — sohbet geçmişi bu andan itibaren gösterilir
  // (odada olan herkes kendi girişinden sonraki tüm mesajları görür).
  joinedAt: number;
}

export interface ChatMessage {
  type?: 'text' | 'voice'; // eski kayıtlar type'sız = text
  text?: string;
  audio?: Buffer; // voice: opus/webm ya da mp4 ham veri
  mime?: string;
  dur?: number; // saniye
  displayName: string;
  ts: number;
}

// Oda sohbet bellek sınırları: mesaj sayısı + toplam ses byte bütçesi.
// Bütçe aşılırsa en eski SES mesajları düşer (metinler kalır).
const MAX_MESSAGES = 300;
const MAX_VOICE_BYTES = 6 * 1024 * 1024;

export function trimMessages(room: KizmaRoom): void {
  if (room.messages.length > MAX_MESSAGES) {
    room.messages.splice(0, room.messages.length - MAX_MESSAGES);
  }
  let voiceBytes = room.messages.reduce((s, m) => s + (m.audio?.length ?? 0), 0);
  while (voiceBytes > MAX_VOICE_BYTES) {
    const idx = room.messages.findIndex((m) => m.type === 'voice');
    if (idx === -1) break;
    voiceBytes -= room.messages[idx].audio?.length ?? 0;
    room.messages.splice(idx, 1);
  }
}

export interface KizmaRoom {
  code: string;
  players: KizmaPlayer[];
  state: KizmaGameState | null;
  createdAt: number;
  messages: ChatMessage[];
  locked?: boolean;
}

const rooms = new Map<string, KizmaRoom>();
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STALE_MS = 2 * 60 * 60 * 1000;
const MAX_PLAYERS = 4;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

function cleanup(): void {
  const now = Date.now();
  for (const [k, r] of rooms) if (now - r.createdAt > STALE_MS) rooms.delete(k);
}

export function createRoom(
  userId: string, displayName: string, socketId: string, avatarUrl?: string,
): KizmaRoom {
  cleanup();
  let code: string;
  do { code = generateCode(); } while (rooms.has(code));
  const room: KizmaRoom = {
    code,
    players: [{ userId, displayName, avatarUrl, socketId, color: null, ready: false, connected: true, isHost: true, joinedAt: Date.now() }],
    state: null,
    createdAt: Date.now(),
    messages: [],
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(
  code: string, userId: string, displayName: string, socketId: string, avatarUrl?: string,
): { room: KizmaRoom; error?: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { room: null as unknown as KizmaRoom, error: 'Oda bulunamadı.' };
  if (room.state) return { room: null as unknown as KizmaRoom, error: 'Oyun zaten başladı.' };
  // Aynı kullanıcı tekrar katılıyorsa socket'i güncelle (sekme yenileme/2. giriş)
  const existing = room.players.find((p) => p.userId === userId);
  if (existing) {
    existing.socketId = socketId;
    existing.connected = true;
    existing.displayName = displayName;
    existing.avatarUrl = avatarUrl;
    return { room };
  }
  if (room.players.filter((p) => p.connected).length >= MAX_PLAYERS) {
    return { room: null as unknown as KizmaRoom, error: 'Oda dolu.' };
  }
  room.players.push({ userId, displayName, avatarUrl, socketId, color: null, ready: false, connected: true, isHost: false, joinedAt: Date.now() });
  return { room };
}

/** Renk seçimi — boşsa ve başkasında değilse uygula. */
export function selectColor(
  code: string, userId: string, color: KizmaColor,
): { room: KizmaRoom; error?: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room || room.state) return { room: null as unknown as KizmaRoom, error: 'Oda uygun değil.' };
  const taken = room.players.some((p) => p.userId !== userId && p.color === color);
  if (taken) return { room, error: 'Bu renk alınmış.' };
  const player = room.players.find((p) => p.userId === userId);
  if (!player) return { room, error: 'Oyuncu bulunamadı.' };
  player.color = color;
  return { room };
}

/** Hazır durumu — renk seçilmeden ready olunamaz. */
export function setReady(
  code: string, userId: string, ready: boolean,
): { room: KizmaRoom; error?: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room || room.state) return { room: null as unknown as KizmaRoom, error: 'Oda uygun değil.' };
  const player = room.players.find((p) => p.userId === userId);
  if (!player) return { room, error: 'Oyuncu bulunamadı.' };
  if (ready && !player.color) return { room, error: 'Önce renk seç.' };
  player.ready = ready;
  return { room };
}

export function getRoom(code: string): KizmaRoom | undefined {
  return rooms.get(code.toUpperCase());
}

export function getRoomBySocketId(socketId: string): KizmaRoom | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) return room;
  }
  return undefined;
}

export function rejoinRoom(code: string, userId: string, socketId: string): KizmaRoom | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  const player = room.players.find((p) => p.userId === userId);
  if (!player) return null;
  player.socketId = socketId;
  player.connected = true;
  return room;
}

export function disconnectPlayer(socketId: string): { room: KizmaRoom; player: KizmaPlayer } | null {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) {
      player.connected = false;
      // Oyun başlamadıysa oyuncuyu odadan tamamen çıkar (lobby temiz kalsın)
      if (!room.state) {
        room.players = room.players.filter((p) => p.socketId !== socketId);
        // Host ayrıldıysa host'u devret
        if (player.isHost && room.players.length > 0 && !room.players.some((p) => p.isHost)) {
          room.players[0].isHost = true;
        }
      }
      return { room, player };
    }
  }
  return null;
}
