import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { createRoom, joinRoom, rejoinRoom, getRoomBySocketId, disconnectPlayer } from './rooms';
import {
  createInitialState, rollDice, applyRoll, getLegalMoves, applyMove,
} from './engine';
import type { Move } from './engine';

interface JwtPayload { sub: string; role: string; }

export function attachTavlaSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // ── Auth middleware ────────────────────────────────────────────────────────
  io.use((socket, next) => {
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

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId: string = socket.data.userId;

    // Create room
    socket.on('tavla:create', ({ displayName }: { displayName: string }) => {
      const room = createRoom(userId, displayName, socket.id);
      socket.join(room.code);
      socket.emit('tavla:created', { code: room.code });
    });

    // Join room
    socket.on('tavla:join', ({ code, displayName }: { code: string; displayName: string }) => {
      const room = joinRoom(code, userId, displayName, socket.id);
      if (!room) {
        socket.emit('tavla:error', { message: 'Oda bulunamadı veya dolu.' });
        return;
      }

      socket.join(room.code);

      // Init game state, randomly pick who goes first
      const state = createInitialState();
      state.turn = Math.random() < 0.5 ? 'white' : 'black';
      room.state = state;

      const playerInfo = room.players.map(p => ({
        displayName: p.displayName,
        color: p.color,
      }));

      for (const player of room.players) {
        io.to(player.socketId).emit('tavla:game_start', {
          state,
          myColor: player.color,
          players: playerInfo,
          code: room.code,
        });
      }
    });

    // Rejoin after page refresh
    socket.on('tavla:rejoin', ({ code }: { code: string }) => {
      const room = rejoinRoom(code, userId, socket.id);
      if (!room?.state) {
        socket.emit('tavla:error', { message: 'Oyun bulunamadı.' });
        return;
      }
      socket.join(room.code);
      const player = room.players.find(p => p.userId === userId)!;
      const playerInfo = room.players.map(p => ({
        displayName: p.displayName,
        color: p.color,
      }));
      socket.emit('tavla:reconnected', {
        state: room.state,
        myColor: player.color,
        players: playerInfo,
        code: room.code,
      });
      // Notify the other player
      for (const p of room.players) {
        if (p.userId !== userId && p.connected) {
          io.to(p.socketId).emit('tavla:opponent_reconnected');
        }
      }
    });

    // Roll dice
    socket.on('tavla:roll', () => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.state) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.color !== room.state.turn) return;
      if (room.state.phase !== 'rolling') return;

      const [d1, d2] = rollDice();
      let state = applyRoll(room.state, d1, d2);

      // Auto-pass if no legal moves
      if (getLegalMoves(state).length === 0) {
        const next = state.turn === 'white' ? 'black' : 'white';
        state = { ...state, turn: next, phase: 'rolling', movesLeft: [] };
      }

      room.state = state;
      io.to(room.code).emit('tavla:state', { state });
    });

    // Make a move
    socket.on('tavla:move', (move: Move) => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.state) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.color !== room.state.turn) return;
      if (room.state.phase !== 'moving') return;

      const legal = getLegalMoves(room.state);
      const ok = legal.some(m => m.from === move.from && m.to === move.to && m.die === move.die);
      if (!ok) {
        socket.emit('tavla:error', { message: 'Geçersiz hamle.' });
        return;
      }

      room.state = applyMove(room.state, move);
      io.to(room.code).emit('tavla:state', { state: room.state });
    });

    // Resign
    socket.on('tavla:resign', () => {
      const room = getRoomBySocketId(socket.id);
      if (!room?.state || room.state.phase === 'ended') return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      const winner = player.color === 'white' ? 'black' : 'white';
      room.state = { ...room.state, winner, phase: 'ended' };
      io.to(room.code).emit('tavla:state', { state: room.state });
    });

    // Disconnect — keep room alive for rejoin
    socket.on('disconnect', () => {
      const result = disconnectPlayer(socket.id);
      if (result) {
        io.to(result.room.code).emit('tavla:opponent_left');
      }
    });
  });

  return io;
}
