import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
const SOCKET_URL = BASE.replace(/\/api$/, '');

export function createTavlaSocket(): Socket {
  return io(SOCKET_URL, {
    path: '/api/socket.io',
    auth: { token: getAccessToken() },
    transports: ['polling', 'websocket'],
  });
}

// Kızma Birader, aynı Socket.IO server'ında ayrı '/kizma' namespace'inde çalışır.
export function createKizmaBiraderSocket(): Socket {
  return io(`${SOCKET_URL}/kizma`, {
    path: '/api/socket.io',
    auth: { token: getAccessToken() },
    transports: ['polling', 'websocket'],
  });
}
