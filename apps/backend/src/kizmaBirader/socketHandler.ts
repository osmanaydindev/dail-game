// Kızma Birader — Socket.IO handler. Tavla'yı bozmamak için ayrı '/kizma'
// namespace'inde çalışır; aynı io server + aynı path ('/api/socket.io').
// Tüm hamleler sunucuda doğrulanır; istemciye güvenilmez.

import type { Server, Namespace, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';
import {
  createRoom, joinRoom, selectColor, setReady, rejoinRoom,
  getRoomBySocketId, disconnectPlayer, getRoom,
} from './rooms';
import type { KizmaRoom } from './rooms';
import {
  createInitialState, rollDice, applyRoll, getLegalMoves, applyMove, COLORS_ORDER,
} from './engine';
import type { KizmaColor, KizmaMove } from './types';

interface JwtPayload { sub: string; role: string; }

function lobbyPayload(room: KizmaRoom) {
  const players = room.players.map((p) => ({
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    color: p.color,
    ready: p.ready,
    connected: p.connected,
    isHost: p.isHost,
  }));
  const takenColors = room.players
    .filter((p) => p.color)
    .map((p) => p.color) as KizmaColor[];
  const readyCount = room.players.filter((p) => p.connected && p.color && p.ready).length;
  const canStart = room.players.filter((p) => p.connected).length >= 3
    && room.players.filter((p) => p.connected).every((p) => p.color && p.ready);
  return { code: room.code, players, takenColors, readyCount, canStart };
}

function emitLobby(nsp: Namespace, room: KizmaRoom): void {
  nsp.to(room.code).emit('kizma:lobby', lobbyPayload(room));
}

function emitState(nsp: Namespace, room: KizmaRoom): void {
  if (!room.state) return;
  const legalMoves = getLegalMoves(room.state);
  nsp.to(room.code).emit('kizma:state', { state: room.state, legalMoves });
}

export function attachKizmaBiraderSocket(io: Server): void {
  const nsp = io.of('/kizma');

  // ── Auth (Tavla ile aynı JWT deseni) ──────────────────────────────────────
  nsp.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as JwtPayload;
      socket.data.userId = payload.sub;
      // Avatar sunucudan okunur (istemciden gelen URL'e güvenilmez); opsiyonel.
      try {
        const u = await User.findById(payload.sub).select('avatarUrl').lean();
        socket.data.avatarUrl = u?.avatarUrl ?? undefined;
      } catch { /* avatar yoksa da oyun devam eder */ }
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  nsp.on('connection', (socket: Socket) => {
    const userId: string = socket.data.userId;

    // ── Oda oluştur ──────────────────────────────────────────────────────────
    socket.on('kizma:create', ({ displayName }: { displayName: string }) => {
      const room = createRoom(userId, displayName, socket.id, socket.data.avatarUrl);
      socket.join(room.code);
      socket.emit('kizma:created', { code: room.code });
      emitLobby(nsp, room);
    });

    // ── Odaya katıl ────────────────────────────────────────────────────────────
    socket.on('kizma:join', ({ code, displayName }: { code: string; displayName: string }) => {
      // Oyun başlamış ve kullanıcı zaten bu odadaysa → rejoin olarak işle
      const existing = getRoom(code);
      if (existing?.state) {
        const wasPlayer = existing.players.find((p) => p.userId === userId);
        if (wasPlayer) {
          const rejoined = rejoinRoom(code, userId, socket.id);
          if (!rejoined?.state) {
            socket.emit('kizma:error', { message: 'Odaya yeniden bağlanılamadı.' });
            return;
          }
          socket.join(rejoined.code);
          const player = rejoined.players.find((p) => p.userId === userId)!;
          socket.emit('kizma:reconnected', {
            state: rejoined.state,
            myColor: player.color,
            code: rejoined.code,
            players: rejoined.players.map((p) => ({ displayName: p.displayName, avatarUrl: p.avatarUrl, color: p.color })),
            legalMoves: getLegalMoves(rejoined.state),
            messages: rejoined.messages ?? [],
          });
          for (const p of rejoined.players) {
            if (p.userId !== userId && p.connected) {
              nsp.to(p.socketId).emit('kizma:opponent_reconnected', { displayName: wasPlayer.displayName });
            }
          }
          emitLobby(nsp, rejoined);
          return;
        }
        socket.emit('kizma:error', { message: 'Oyun zaten başladı.' });
        return;
      }

      const { room, error } = joinRoom(code, userId, displayName, socket.id, socket.data.avatarUrl);
      if (error || !room) {
        socket.emit('kizma:error', { message: error ?? 'Odaya katılınamadı.' });
        return;
      }
      socket.join(room.code);
      socket.emit('kizma:joined', { code: room.code });
      nsp.to(room.code).emit('kizma:player_joined', { displayName });
      emitLobby(nsp, room);
    });

    // ── Renk seç ────────────────────────────────────────────────────────────────
    socket.on('kizma:select_color', ({ color }: { color: KizmaColor }) => {
      const current = getRoomBySocketId(socket.id);
      if (!current) return;
      const { room, error } = selectColor(current.code, userId, color);
      if (error) { socket.emit('kizma:error', { message: error }); }
      if (room) emitLobby(nsp, room);
    });

    // ── Hazır ────────────────────────────────────────────────────────────────────
    socket.on('kizma:ready', ({ ready }: { ready: boolean }) => {
      const current = getRoomBySocketId(socket.id);
      if (!current) return;
      const { room, error } = setReady(current.code, userId, ready);
      if (error) { socket.emit('kizma:error', { message: error }); }
      if (room) emitLobby(nsp, room);
    });

    // ── Oyunu başlat (host) ──────────────────────────────────────────────────────
    socket.on('kizma:start', () => {
      const room = getRoomBySocketId(socket.id);
      if (!room || room.state) return;
      const me = room.players.find((p) => p.socketId === socket.id);
      if (!me?.isHost) {
        socket.emit('kizma:error', { message: 'Sadece oda sahibi başlatabilir.' });
        return;
      }
      const active = room.players.filter((p) => p.connected && p.color && p.ready);
      if (active.length < 3) {
        socket.emit('kizma:error', { message: 'En az 3 hazır oyuncu gerekli.' });
        return;
      }
      if (!room.players.filter((p) => p.connected).every((p) => p.color && p.ready)) {
        socket.emit('kizma:error', { message: 'Tüm oyuncular renk seçip hazır olmalı.' });
        return;
      }
      const activeColors = active.map((p) => p.color as KizmaColor);
      room.state = createInitialState(activeColors);

      for (const player of room.players) {
        if (!player.color) continue;
        nsp.to(player.socketId).emit('kizma:game_start', {
          state: room.state,
          myColor: player.color,
          code: room.code,
          players: room.players.map((p) => ({ displayName: p.displayName, avatarUrl: p.avatarUrl, color: p.color })),
          legalMoves: getLegalMoves(room.state),
        });
      }
    });

    // ── Zar at ────────────────────────────────────────────────────────────────────
    socket.on('kizma:roll', () => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.state || room.locked || room.state.phase !== 'rolling' || room.state.winner) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || player.color !== room.state.turn) return;

      const die = rollDice();
      nsp.to(room.code).emit('kizma:dice', { die, by: player.color });

      const result = applyRoll(room.state, die);

      if (result.phase === 'moving') {
        // Oynanabilir hamle var → zar görünür kalır, oyuncu taşını seçer.
        room.state = result;
        emitState(nsp, room);
        return;
      }

      // Hamle yok / üç-6 → tur geçecek. Önce atılan zarı göster, sonra pas et.
      // Kilit: bu bekleme sırasında kimse zar atamaz/oynayamaz (race önleme).
      const before = room.state;
      // phase 'moving' + boş legalMoves: zar görünür ama "Zar At" butonu çıkmaz,
      // taş da highlight olmaz; FE "Hamle yok" gösterir.
      const displayState = { ...before, dice: die, phase: 'moving' as const, lastEvent: 'pass' as const };
      room.locked = true;
      nsp.to(room.code).emit('kizma:state', { state: displayState, legalMoves: [] });
      setTimeout(() => {
        const live = getRoomBySocketId(player.socketId) ?? room;
        live.state = result;
        live.locked = false;
        emitState(nsp, live);
      }, 1400);
    });

    // ── Hamle yap ────────────────────────────────────────────────────────────────
    socket.on('kizma:move', (move: KizmaMove) => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.state || room.locked || room.state.phase !== 'moving' || room.state.winner) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || player.color !== room.state.turn) return;

      const legal = getLegalMoves(room.state);
      const ok = legal.some(
        (m) => m.color === move.color && m.tokenId === move.tokenId && m.die === move.die,
      );
      if (!ok) {
        socket.emit('kizma:error', { message: 'Geçersiz hamle.' });
        return;
      }
      room.state = applyMove(room.state, move);
      emitState(nsp, room);
    });

    // ── Yeniden bağlan ───────────────────────────────────────────────────────────
    socket.on('kizma:rejoin', ({ code }: { code: string }) => {
      const room = rejoinRoom(code, userId, socket.id);
      if (!room) {
        socket.emit('kizma:error', { message: 'Oda bulunamadı.' });
        return;
      }
      socket.join(room.code);
      const player = room.players.find((p) => p.userId === userId)!;
      if (room.state) {
        socket.emit('kizma:reconnected', {
          state: room.state,
          myColor: player.color,
          code: room.code,
          players: room.players.map((p) => ({ displayName: p.displayName, avatarUrl: p.avatarUrl, color: p.color })),
          legalMoves: getLegalMoves(room.state),
          messages: room.messages ?? [],
        });
      } else {
        socket.emit('kizma:lobby', lobbyPayload(room));
      }
      emitLobby(nsp, room);
    });

    // ── Sohbet ────────────────────────────────────────────────────────────────────
    socket.on('kizma:message', ({ text }: { text: string }) => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.state || !text?.trim()) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return;
      const msg = { text: text.trim().slice(0, 300), displayName: player.displayName, ts: Date.now() };
      room.messages = room.messages ?? [];
      room.messages.push(msg);
      if (room.messages.length > 50) room.messages.shift();
      nsp.to(room.code).emit('kizma:message', msg);
    });

    // ── Bağlantı koptu ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const result = disconnectPlayer(socket.id);
      if (result) {
        nsp.to(result.room.code).emit('kizma:player_left', { displayName: result.player.displayName });
        emitLobby(nsp, result.room);
      }
    });
  });
}

// COLORS_ORDER tekrar export — FE/diğer modüller gerekirse kullanır
export { COLORS_ORDER };
