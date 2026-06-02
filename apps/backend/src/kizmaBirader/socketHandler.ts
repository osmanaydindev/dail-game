// Kızma Birader — Socket.IO handler. Tavla'yı bozmamak için ayrı '/kizma'
// namespace'inde çalışır; aynı io server + aynı path ('/api/socket.io').
// Tüm hamleler sunucuda doğrulanır; istemciye güvenilmez.

import type { Server, Namespace, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import {
  createRoom, joinRoom, selectColor, setReady, rejoinRoom,
  getRoomBySocketId, disconnectPlayer,
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
  nsp.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as JwtPayload;
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  nsp.on('connection', (socket: Socket) => {
    const userId: string = socket.data.userId;

    // ── Oda oluştur ──────────────────────────────────────────────────────────
    socket.on('kizma:create', ({ displayName }: { displayName: string }) => {
      const room = createRoom(userId, displayName, socket.id);
      socket.join(room.code);
      socket.emit('kizma:created', { code: room.code });
      emitLobby(nsp, room);
    });

    // ── Odaya katıl ────────────────────────────────────────────────────────────
    socket.on('kizma:join', ({ code, displayName }: { code: string; displayName: string }) => {
      const { room, error } = joinRoom(code, userId, displayName, socket.id);
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
          players: room.players.map((p) => ({ displayName: p.displayName, color: p.color })),
          legalMoves: getLegalMoves(room.state),
        });
      }
    });

    // ── Zar at ────────────────────────────────────────────────────────────────────
    socket.on('kizma:roll', () => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.state || room.state.phase !== 'rolling' || room.state.winner) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player || player.color !== room.state.turn) return;

      const die = rollDice();
      room.state = applyRoll(room.state, die);
      // Zarın görünmesi için: önce zarı bildir, sonra state (FE zar animasyonu yapabilir)
      nsp.to(room.code).emit('kizma:dice', { die, by: player.color });
      emitState(nsp, room);
    });

    // ── Hamle yap ────────────────────────────────────────────────────────────────
    socket.on('kizma:move', (move: KizmaMove) => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.state || room.state.phase !== 'moving' || room.state.winner) return;
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
          players: room.players.map((p) => ({ displayName: p.displayName, color: p.color })),
          legalMoves: getLegalMoves(room.state),
        });
      } else {
        socket.emit('kizma:lobby', lobbyPayload(room));
      }
      emitLobby(nsp, room);
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
