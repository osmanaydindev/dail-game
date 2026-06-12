'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, VStack, HStack, Text, Button, Input, Alert, Spinner, SimpleGrid,
} from '@chakra-ui/react';
import type { Socket } from 'socket.io-client';
import { createKizmaBiraderSocket } from '@/lib/socket';
import { KizmaBoard } from './KizmaBoard';
import { PlayerCard } from './PlayerCard';
import {
  KIZMA_COLORS, COLOR_HEX, COLOR_LABEL_TR,
} from './types';
import type {
  KizmaColor, KizmaGameState, KizmaMove, LobbyPayload, GamePlayerInfo,
} from './types';

const STORAGE_KEY = 'kizma-room';
const storage = typeof window !== 'undefined' ? localStorage : null;
const TURN_SECONDS = 30;
const QUICK_REPLIES = ['selam 👋', 'iyi oyunlar 🍀', 'seri lütfen! 🚀', 'tebrikler! 🎉'];

interface ChatMsg {
  type?: 'text' | 'voice';
  text?: string;
  audio?: ArrayBuffer;
  mime?: string;
  dur?: number;
  displayName: string;
  ts: number;
}

// ── Sesli mesaj balonu — oynat/durdur ────────────────────────────────────────
function VoiceBubble({ audio, mime, dur }: { audio: ArrayBuffer; mime?: string; dur?: number }) {
  const [playing, setPlaying] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { audioElRef.current?.pause(); }, []);

  const toggle = () => {
    let a = audioElRef.current;
    if (!a) {
      a = new Audio(URL.createObjectURL(new Blob([audio], { type: mime || 'audio/webm' })));
      a.onended = () => setPlaying(false);
      audioElRef.current = a;
    }
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.currentTime = 0;
      a.play().catch(() => {});
      setPlaying(true);
    }
  };

  return (
    <button
      onClick={toggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, cursor: 'pointer' }}
      aria-label={playing ? 'Sesi durdur' : 'Sesi oynat'}
    >
      <span>{playing ? '⏸️' : '▶️'}</span>
      <span>🎤 {dur ?? 0} sn</span>
    </button>
  );
}

// ── Web Audio sesler ──────────────────────────────────────────────────────────
function playDiceSound() {
  try {
    const ctx = new AudioContext();
    const times = [0, 0.06, 0.12, 0.20, 0.29, 0.38, 0.49, 0.54];
    times.forEach((t) => {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.025), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.025);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime + t);
    });
    setTimeout(() => ctx.close(), 700);
  } catch {}
}

function playTurnSound() {
  try {
    const ctx = new AudioContext();
    [440, 554, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.32);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {}
}

function playMoveStepSound() {
  try {
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / ctx.sampleRate) * 80) * 0.55;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.8;
    src.connect(filter);
    filter.connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close(), 300);
  } catch {}
}

function playCaptureSound() {
  try {
    const ctx = new AudioContext();
    ([0, 0.045] as const).forEach((delay, i) => {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.1), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) {
        const t = j / ctx.sampleRate;
        data[j] = (Math.random() * 2 - 1) * Math.exp(-t * (i === 0 ? 90 : 45)) * (i === 0 ? 0.95 : 0.5);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = i === 0 ? 750 : 280;
      filter.Q.value = 1;
      src.connect(filter);
      filter.connect(ctx.destination);
      src.start(ctx.currentTime + delay);
    });
    setTimeout(() => ctx.close(), 500);
  } catch {}
}

interface Props {
  user: { _id: string; displayName: string };
}

type Screen = 'home' | 'lobby' | 'game';

export function KizmaBiraderGame({ user }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const rejoinRef = useRef(false);
  const prevStateRef = useRef<KizmaGameState | null>(null);
  const prevTurnRef = useRef<KizmaColor | null>(null);
  const myColorRef = useRef<KizmaColor | null>(null);
  const gameStateRef = useRef<KizmaGameState | null>(null);
  const legalMovesRef = useRef<KizmaMove[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [screen, setScreen] = useState<Screen>('home');
  const [lobby, setLobby] = useState<LobbyPayload | null>(null);
  const [gameState, setGameState] = useState<KizmaGameState | null>(null);
  const [legalMoves, setLegalMoves] = useState<KizmaMove[]>([]);
  const [myColor, setMyColor] = useState<KizmaColor | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayerInfo[]>([]);
  const [code, setCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  // Zar animasyonu: hangi oyuncunun kartındaki yuvada döndüğü + o anki rastgele yüz.
  const [diceAnim, setDiceAnim] = useState<{ by: KizmaColor; face: number } | null>(null);
  const diceIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTurnNotif, setShowTurnNotif] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Sohbet
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [toastMsg, setToastMsg] = useState<ChatMsg | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatOpenRef = useRef(false);

  useEffect(() => { myColorRef.current = myColor; }, [myColor]);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { legalMovesRef.current = legalMoves; }, [legalMoves]);

  useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = createKizmaBiraderSocket();
    socketRef.current = s;

    s.on('kizma:created', ({ code: c }: { code: string }) => {
      setCode(c); setScreen('lobby'); setBusy(false);
      storage?.setItem(STORAGE_KEY, JSON.stringify({ code: c }));
    });
    s.on('kizma:joined', ({ code: c }: { code: string }) => {
      setCode(c); setScreen('lobby'); setBusy(false);
      storage?.setItem(STORAGE_KEY, JSON.stringify({ code: c }));
    });
    s.on('kizma:lobby', (payload: LobbyPayload) => {
      setLobby(payload);
      setScreen((prev) => (prev === 'home' ? 'lobby' : prev));
      setBusy(false);
    });
    s.on('kizma:game_start', (p: {
      state: KizmaGameState; myColor: KizmaColor; code: string;
      players: GamePlayerInfo[]; legalMoves: KizmaMove[];
    }) => {
      storage?.setItem(STORAGE_KEY, JSON.stringify({ code: p.code }));
      prevStateRef.current = p.state;
      prevTurnRef.current = p.state.turn;
      setGameState(p.state); setMyColor(p.myColor); setGamePlayers(p.players);
      setLegalMoves(p.legalMoves); setScreen('game'); setBusy(false);
    });
    s.on('kizma:reconnected', (p: {
      state: KizmaGameState; myColor: KizmaColor | null; code: string;
      players: GamePlayerInfo[]; legalMoves: KizmaMove[]; messages?: ChatMsg[];
    }) => {
      rejoinRef.current = false;
      prevStateRef.current = p.state;
      prevTurnRef.current = p.state.turn;
      setGameState(p.state); setMyColor(p.myColor); setGamePlayers(p.players);
      setLegalMoves(p.legalMoves); setCode(p.code); setScreen('game');
      if (p.messages) setMessages(p.messages);
    });

    const applyState = (p: { state: KizmaGameState; legalMoves: KizmaMove[] }) => {
      const prev = prevStateRef.current;
      const mc = myColorRef.current;
      if (prev) {
        const ev = p.state.lastEvent;
        if (ev === 'capture') playCaptureSound();
      }
      if (mc && p.state.turn === mc && prevTurnRef.current !== mc && p.state.phase === 'rolling') {
        playTurnSound();
        setShowTurnNotif(true);
        setTimeout(() => setShowTurnNotif(false), 2200);
      }
      prevTurnRef.current = p.state.turn;
      prevStateRef.current = p.state;
      setGameState(p.state);
      setLegalMoves(p.legalMoves);
    };

    s.on('kizma:state', (p: { state: KizmaGameState; legalMoves: KizmaMove[] }) => {
      applyState(p);
    });
    s.on('kizma:dice', ({ by }: { die: number; by: KizmaColor }) => {
      // Zar, atan oyuncunun kartındaki yuvada döner; sonuç kizma:state ile oturur.
      playDiceSound();
      if (diceIvRef.current) clearInterval(diceIvRef.current);
      let ticks = 0;
      setDiceAnim({ by, face: Math.ceil(Math.random() * 6) });
      diceIvRef.current = setInterval(() => {
        setDiceAnim({ by, face: Math.ceil(Math.random() * 6) });
        if (++ticks >= 8) {
          if (diceIvRef.current) clearInterval(diceIvRef.current);
          diceIvRef.current = null;
          setDiceAnim(null);
        }
      }, 70);
    });

    s.on('kizma:message', (msg: ChatMsg) => {
      setMessages((prev) => [...prev, msg]);
      if (!chatOpenRef.current) {
        setUnread((n) => n + 1);
        setToastMsg(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastMsg(null), 3500);
      }
    });

    s.on('kizma:error', ({ message }: { message: string }) => {
      if (rejoinRef.current) { rejoinRef.current = false; storage?.removeItem(STORAGE_KEY); }
      setError(message); setBusy(false);
      setTimeout(() => setError(null), 3000);
    });
    s.on('connect_error', () => { setError('Sunucuya bağlanılamadı.'); setBusy(false); });

    s.on('connect', () => {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const { code: c } = JSON.parse(raw) as { code: string };
          rejoinRef.current = true;
          s.emit('kizma:rejoin', { code: c });
        } catch { storage?.removeItem(STORAGE_KEY); }
      }
    });

    return () => {
      if (diceIvRef.current) clearInterval(diceIvRef.current);
      s.disconnect();
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const emit = (ev: string, payload?: unknown) => socketRef.current?.emit(ev, payload);

  const handleCreate = useCallback(() => {
    setBusy(true); setError(null);
    emit('kizma:create', { displayName: user.displayName });
  }, [user.displayName]);

  const handleJoin = useCallback(() => {
    if (joinInput.length !== 6) return;
    setBusy(true); setError(null);
    emit('kizma:join', { code: joinInput, displayName: user.displayName });
  }, [joinInput, user.displayName]);

  const handleSelectColor = (c: KizmaColor) => emit('kizma:select_color', { color: c });
  const handleStart = () => emit('kizma:start');
  const handleRoll = () => emit('kizma:roll');

  const handleTokenClick = useCallback((color: KizmaColor, tokenId: number) => {
    if (!gameState || gameState.dice == null) return;
    emit('kizma:move', { color, tokenId, die: gameState.dice } as KizmaMove);
  }, [gameState]);

  const handleSendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    emit('kizma:message', { text });
    setChatInput('');
  }, [chatInput]);

  // ── Sesli mesaj kaydı (bas-konuş) ───────────────────────────────────────────
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recStartRef = useRef(0);
  const recCancelRef = useRef(false);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recAutoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);

  const stopRec = useCallback((cancel: boolean) => {
    const mr = recRef.current;
    if (!mr) return;
    recRef.current = null;
    recCancelRef.current = cancel;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (recAutoStopRef.current) { clearTimeout(recAutoStopRef.current); recAutoStopRef.current = null; }
    setRecording(false);
    if (mr.state !== 'inactive') mr.stop();
  }, []);

  const startRec = useCallback(async () => {
    if (recRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // iOS Safari webm bilmez; destekli formatı seç
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
      recChunksRef.current = [];
      recCancelRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durMs = Date.now() - recStartRef.current;
        if (recCancelRef.current || durMs < 600) return; // çok kısa / iptal
        const blob = new Blob(recChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size < 800) return;
        if (blob.size > 300 * 1024) {
          setError('Ses mesajı çok büyük.');
          setTimeout(() => setError(null), 3000);
          return;
        }
        const ab = await blob.arrayBuffer();
        socketRef.current?.emit('kizma:voice', { audio: ab, mime: blob.type, dur: Math.round(durMs / 1000) });
      };
      recRef.current = mr;
      recStartRef.current = Date.now();
      setRecSecs(0);
      setRecording(true);
      recTimerRef.current = setInterval(() => {
        setRecSecs(Math.floor((Date.now() - recStartRef.current) / 1000));
      }, 250);
      recAutoStopRef.current = setTimeout(() => stopRec(false), 15000); // maks 15 sn
      mr.start();
    } catch {
      setError('Mikrofon izni alınamadı.');
      setTimeout(() => setError(null), 3000);
    }
  }, [stopRec]);

  // Unmount'ta kaydı sessizce kapat
  useEffect(() => () => {
    recCancelRef.current = true;
    try { recRef.current?.stop(); } catch { /* zaten kapalı */ }
  }, []);

  const handleQuickReply = useCallback((text: string) => {
    emit('kizma:message', { text });
  }, []);

  // ── Sıra sayacı + otomatik hamle ────────────────────────────────────────────
  useEffect(() => {
    if (!gameState || gameState.winner) { setTimeLeft(null); return; }

    let t = TURN_SECONDS;
    setTimeLeft(t);
    const iv = setInterval(() => {
      t -= 1;
      setTimeLeft(t);
      if (t <= 0) {
        clearInterval(iv);
        const gs = gameStateRef.current;
        const mc = myColorRef.current;
        const s = socketRef.current;
        if (!gs || !mc || !s || gs.turn !== mc) return;
        if (gs.phase === 'rolling') {
          s.emit('kizma:roll');
        } else if (gs.phase === 'moving' && legalMovesRef.current.length > 0) {
          s.emit('kizma:move', legalMovesRef.current[0]);
        }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [gameState?.turn, gameState?.phase, gameState?.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveToHome = (clearStorage = false) => {
    if (clearStorage) storage?.removeItem(STORAGE_KEY);
    setScreen('home'); setLobby(null); setGameState(null); setMyColor(null);
    setGamePlayers([]); setCode(''); setJoinInput(''); setLegalMoves([]);
    setMessages([]); setUnread(0); setToastMsg(null);
    prevStateRef.current = null; prevTurnRef.current = null;
  };

  const me = lobby?.players.find((p) => p.displayName === user.displayName);
  const amHost = !!me?.isHost;

  // ── HOME ─────────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <VStack gap={6} maxW="380px" mx="auto" pt={8} px={4}>
        <Box textAlign="center">
          <Text fontSize="2xl" fontWeight="800" mb={1}>Kızma Birader</Text>
          <Text fontSize="sm" color="text.muted">Oda oluştur veya oda koduyla katıl (3–4 oyuncu)</Text>
        </Box>
        {error && (
          <Alert.Root status="error" borderRadius="lg" w="full">
            <Alert.Indicator /><Alert.Title fontSize="sm">{error}</Alert.Title>
          </Alert.Root>
        )}
        <Box w="full" bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" p={5}>
          <Text fontWeight="700" mb={3}>Yeni Oda</Text>
          <Button w="full" colorPalette="brand" onClick={handleCreate} loading={busy}>Oda Oluştur</Button>
        </Box>
        <Box w="full" bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" p={5}>
          <Text fontWeight="700" mb={3}>Odaya Katıl</Text>
          <HStack>
            <Input
              placeholder="Oda kodu" value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              maxLength={6} fontFamily="mono" fontSize="lg" fontWeight="700" letterSpacing="widest"
            />
            <Button colorPalette="brand" variant="outline" onClick={handleJoin} disabled={joinInput.length !== 6} loading={busy}>
              Katıl
            </Button>
          </HStack>
        </Box>
      </VStack>
    );
  }

  // ── LOBBY ────────────────────────────────────────────────────────────────────
  if (screen === 'lobby') {
    const connected = lobby?.players.filter((p) => p.connected) ?? [];
    return (
      <VStack gap={5} maxW="460px" mx="auto" pt={6} px={4}>
        <Box textAlign="center">
          <Text fontSize="xs" color="text.muted" mb={1}>Oda kodu — arkadaşlarına gönder</Text>
          <Text fontSize="3xl" fontWeight="900" fontFamily="mono" letterSpacing="widest">{code}</Text>
        </Box>
        {error && (
          <Alert.Root status="error" borderRadius="lg" w="full">
            <Alert.Indicator /><Alert.Title fontSize="sm">{error}</Alert.Title>
          </Alert.Root>
        )}
        <Box w="full" bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" p={4}>
          <Text fontWeight="700" mb={3} fontSize="sm">Renk Seç</Text>
          <SimpleGrid columns={4} gap={3}>
            {KIZMA_COLORS.map((c) => {
              const takenByOther = (lobby?.takenColors.includes(c) ?? false) && me?.color !== c;
              const selected = me?.color === c;
              return (
                <Button
                  key={c} onClick={() => handleSelectColor(c)} disabled={takenByOther}
                  h="auto" py={3} flexDir="column" gap={1}
                  variant={selected ? 'solid' : 'outline'}
                  borderWidth="2px"
                  borderColor={selected ? COLOR_HEX[c] : 'border.subtle'}
                  opacity={takenByOther ? 0.4 : 1}
                >
                  <Box w="22px" h="22px" borderRadius="full" bg={COLOR_HEX[c]} borderWidth="1px" borderColor="#0e1319" />
                  <Text fontSize="xs">{COLOR_LABEL_TR[c]}</Text>
                </Button>
              );
            })}
          </SimpleGrid>
        </Box>
        <Box w="full" bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" p={4}>
          <HStack justify="space-between" mb={2}>
            <Text fontWeight="700" fontSize="sm">Oyuncular ({connected.length}/4)</Text>
            <Text fontSize="xs" color="text.muted">Hazır: {lobby?.readyCount ?? 0}</Text>
          </HStack>
          <VStack align="stretch" gap={2}>
            {connected.map((p, i) => (
              <HStack key={i} justify="space-between" bg="surface.subtle" borderRadius="md" px={3} py={2}>
                <HStack gap={2}>
                  <Box w="14px" h="14px" borderRadius="full" bg={p.color ? COLOR_HEX[p.color] : 'transparent'} borderWidth="1px" borderColor="border.subtle" />
                  <Text fontSize="sm" fontWeight="600">{p.displayName}</Text>
                  {p.isHost && <Text fontSize="2xs" color="text.muted">(host)</Text>}
                </HStack>
                <Text fontSize="xs" color={p.ready ? 'green.400' : 'text.muted'} fontWeight="600">
                  {p.ready ? 'Hazır' : 'Bekliyor'}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
        <HStack w="full" gap={3}>
          <Button flex={1} colorPalette={me?.ready ? 'gray' : 'green'} variant={me?.ready ? 'outline' : 'solid'}
            disabled={!me?.color} onClick={() => emit('kizma:ready', { ready: !me?.ready })}>
            {me?.ready ? 'Hazır değilim' : 'Hazırım'}
          </Button>
          {amHost && (
            <Button flex={1} colorPalette="brand" disabled={!lobby?.canStart} onClick={handleStart}>
              Başlat
            </Button>
          )}
        </HStack>
        <Button variant="ghost" size="sm" color="text.muted" onClick={() => leaveToHome(true)}>Odadan çık</Button>
      </VStack>
    );
  }

  // ── GAME ─────────────────────────────────────────────────────────────────────
  if (!gameState) return <Box display="flex" justifyContent="center" pt={20}><Spinner /></Box>;

  const isMyTurn = gameState.turn === myColor && !gameState.winner;
  const nameOf = (c: KizmaColor) => gamePlayers.find((p) => p.color === c)?.displayName ?? c;
  const avatarOf = (c: KizmaColor) => gamePlayers.find((p) => p.color === c)?.avatarUrl;
  const finishedCount = (c: KizmaColor) =>
    gameState.players.find((p) => p.color === c)?.tokens.filter((t) => t.pos === 57).length ?? 0;

  const renderCard = (c: KizmaColor, align: 'left' | 'right') => {
    if (!gameState.activeColors.includes(c)) return <Box key={c} />;
    const rolling = diceAnim?.by === c;
    const dieFace = !rolling && gameState.dice != null && gameState.turn === c ? gameState.dice : null;
    const isTurn = gameState.turn === c && !gameState.winner;
    const canRoll = isTurn && c === myColor && gameState.phase === 'rolling' && !rolling;
    return (
      <PlayerCard
        key={c}
        name={nameOf(c)}
        avatarUrl={avatarOf(c)}
        color={c}
        finished={finishedCount(c)}
        isTurn={isTurn}
        canRoll={canRoll}
        dieFace={dieFace}
        rolling={rolling}
        rollingFace={diceAnim?.face ?? 1}
        onRollTap={handleRoll}
        align={align}
      />
    );
  };

  const statusMsg = () => {
    if (gameState.winner) return gameState.winner === myColor ? '🏆 Kazandın!' : `${nameOf(gameState.winner)} kazandı`;
    if (isMyTurn) {
      if (gameState.phase === 'rolling') return 'Zarını at!';
      return legalMoves.length === 0 ? 'Hamle yok…' : 'Taşını seç';
    }
    return `${nameOf(gameState.turn)} oynuyor...`;
  };

  return (
    <Box className="kb-container" position="relative" w="full" minH="60vh">
      {/* Sıra sende bildirimi */}
      <Box
        position="fixed"
        bottom="90px"
        left="50%"
        transform={`translateX(-50%) translateY(${showTurnNotif ? '0' : '16px'})`}
        opacity={showTurnNotif ? 1 : 0}
        transition="opacity 0.25s ease, transform 0.25s ease"
        pointerEvents="none"
        zIndex={60}
        bg="green.600"
        color="white"
        px={6} py={3}
        borderRadius="full"
        fontWeight="800"
        fontSize="md"
        boxShadow="0 4px 24px rgba(0,0,0,0.35)"
        whiteSpace="nowrap"
      >
        Sıra Sende! 🎲
      </Box>

      {/* Mesaj toast balonu */}
      {toastMsg && (
        <Box
          position="fixed"
          bottom="150px"
          left="50%"
          transform="translateX(-50%)"
          pointerEvents="none"
          zIndex={65}
          bg="surface.card"
          borderRadius="2xl"
          px={4} py={2.5}
          borderWidth="1px"
          borderColor="border.subtle"
          boxShadow="0 8px 32px rgba(0,0,0,0.28)"
          maxW="260px"
          w="max-content"
        >
          <Text fontSize="2xs" color="text.muted" fontWeight="600" mb={0.5}>{toastMsg.displayName}</Text>
          <Text fontSize="sm" fontWeight="600">{toastMsg.type === 'voice' ? '🎤 Sesli mesaj' : toastMsg.text}</Text>
        </Box>
      )}

      {/* Chat backdrop */}
      {chatOpen && (
        <Box position="fixed" inset={0} zIndex={49} onClick={() => setChatOpen(false)} />
      )}

      {/* Sohbet paneli */}
      <Box
        position="fixed"
        right={chatOpen ? '0' : '-310px'}
        top="64px"
        bottom={0}
        w="300px"
        bg="surface.card"
        borderLeftWidth="1px"
        borderColor="border.subtle"
        boxShadow="-4px 0 24px rgba(0,0,0,0.18)"
        transition="right 0.28s ease"
        zIndex={50}
        display="flex"
        flexDir="column"
      >
        <HStack justify="space-between" px={4} py={3} borderBottomWidth="1px" borderColor="border.subtle">
          <Text fontWeight="700" fontSize="sm">Sohbet</Text>
          <Button size="xs" variant="ghost" onClick={() => setChatOpen(false)}>✕</Button>
        </HStack>
        <Box flex={1} overflowY="auto" px={3} py={2} display="flex" flexDir="column" gap={2}>
          {messages.map((m, i) => (
            <Box key={i}>
              <Text fontSize="2xs" color="text.muted" mb={0.5}>
                {m.displayName} · {new Date(m.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Box
                bg={m.displayName === user.displayName ? 'brand.500' : 'surface.subtle'}
                color={m.displayName === user.displayName ? 'white' : undefined}
                px={3} py={1.5} borderRadius="lg" fontSize="sm" maxW="240px"
                alignSelf={m.displayName === user.displayName ? 'flex-end' : 'flex-start'}
              >
                {m.type === 'voice' && m.audio
                  ? <VoiceBubble audio={m.audio} mime={m.mime} dur={m.dur} />
                  : m.text}
              </Box>
            </Box>
          ))}
          <div ref={chatBottomRef} />
        </Box>
        {/* Hazır mesajlar */}
        <Box px={3} pt={2} pb={1} display="flex" flexWrap="wrap" gap="6px">
          {QUICK_REPLIES.map((t) => (
            <Button
              key={t} size="xs" variant="outline" borderRadius="full"
              fontSize="2xs" fontWeight="600" h="24px" px={2.5}
              onClick={() => handleQuickReply(t)}
            >
              {t}
            </Button>
          ))}
        </Box>
        <Box px={3} py={2} borderTopWidth="1px" borderColor="border.subtle">
          <HStack gap={2}>
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendChat(); } }}
              placeholder={recording ? `🔴 Kaydediliyor… ${recSecs} sn` : 'Mesaj yaz…'}
              size="sm"
              borderRadius="lg"
              disabled={recording}
            />
            {/* Bas-konuş: basılı tut → kaydet, bırak → gönder, dışarı kaydır → iptal */}
            <Button
              size="sm"
              colorPalette={recording ? 'red' : 'gray'}
              variant={recording ? 'solid' : 'outline'}
              onPointerDown={(e) => { e.preventDefault(); startRec(); }}
              onPointerUp={() => stopRec(false)}
              onPointerLeave={() => stopRec(true)}
              onContextMenu={(e) => e.preventDefault()}
              title="Basılı tut: kaydet · Bırak: gönder · Dışarı kaydır: iptal"
              style={{ touchAction: 'none' }}
            >
              {recording ? `● ${recSecs}` : '🎤'}
            </Button>
            <Button size="sm" colorPalette="brand" onClick={handleSendChat} disabled={!chatInput.trim() || recording}>
              Gönder
            </Button>
          </HStack>
        </Box>
      </Box>

      {/* Chat FAB */}
      <Box position="fixed" bottom="20px" right="20px" zIndex={55}>
        <Box position="relative" display="inline-flex">
          <Button
            borderRadius="full"
            w="52px" h="52px" p={0}
            fontSize="xl"
            colorPalette="brand"
            variant="solid"
            onClick={() => setChatOpen((v) => !v)}
            boxShadow="0 4px 18px rgba(0,0,0,0.28)"
          >
            💬
          </Button>
          {unread > 0 && (
            <Box
              position="absolute" top="-4px" right="-4px"
              bg="red.500" color="white" borderRadius="full"
              w="20px" h="20px" fontSize="2xs" fontWeight="800"
              display="flex" alignItems="center" justifyContent="center"
              pointerEvents="none"
            >
              {unread > 9 ? '9+' : unread}
            </Box>
          )}
        </Box>
      </Box>

      <VStack className="kb-stack" gap={2} align="center" w="full">
        {error && (
          <Alert.Root status="error" borderRadius="lg" maxW="600px" w="full" mx={{ base: 3, md: 0 }}>
            <Alert.Indicator /><Alert.Title fontSize="sm">{error}</Alert.Title>
          </Alert.Root>
        )}

        {/* Üst köşe kartları — tahtadaki çeyreklerle aynı yerleşim */}
        <SimpleGrid
          className="kb-cards kb-cards-top"
          columns={2} gap={2} w="full"
          maxW={{ base: '100vw', md: '560px' }} px={{ base: 2, md: 0 }}
        >
          {renderCard('red', 'left')}
          {renderCard('blue', 'right')}
        </SimpleGrid>

        {/* Board */}
        <Box
          className="kb-board-wrap"
          position="relative"
          w="full" maxW={{ base: '100vw', md: '560px' }}
          aspectRatio={1} mx="auto"
          borderRadius="2xl" overflow="hidden"
          boxShadow="0 12px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)"
        >
          <KizmaBoard
            state={gameState}
            myColor={myColor}
            legalMoves={legalMoves}
            isMyTurn={isMyTurn}
            onTokenClick={handleTokenClick}
            onStepSound={playMoveStepSound}
          />
          {/* Süre badge'i — yard kutusunun ortasında HTML overlay */}
          {!gameState.winner && timeLeft !== null && (() => {
            const centers: Record<KizmaColor, { left: string; top: string }> = {
              red:    { left: '20%', top: '20%' },
              blue:   { left: '80%', top: '20%' },
              yellow: { left: '80%', top: '80%' },
              white:  { left: '20%', top: '80%' },
            };
            const pos = centers[gameState.turn];
            const isLow = isMyTurn && timeLeft <= 10;
            const hex = COLOR_HEX[gameState.turn];
            return (
              <Box
                position="absolute"
                left={pos.left} top={pos.top}
                transform="translate(-50%, -50%)"
                w="36px" h="36px"
                borderRadius="full"
                bg="white"
                display="flex" alignItems="center" justifyContent="center"
                fontSize="xs" fontWeight="800"
                pointerEvents="none" zIndex={5}
                style={{
                  border: `2.5px solid ${isLow ? '#fc8181' : hex}`,
                  color: isLow ? '#fc8181' : hex,
                  boxShadow: `0 2px 10px ${isLow ? '#fc818155' : hex + '55'}`,
                }}
              >
                {timeLeft}
              </Box>
            );
          })()}
        </Box>

        {/* Alt köşe kartları */}
        <SimpleGrid
          className="kb-cards kb-cards-bottom"
          columns={2} gap={2} w="full"
          maxW={{ base: '100vw', md: '560px' }} px={{ base: 2, md: 0 }}
        >
          {renderCard('white', 'left')}
          {renderCard('yellow', 'right')}
        </SimpleGrid>

        {/* Aksiyon şeridi — durum pill'i (sıra sende + zar bekleniyorsa butona dönüşür) */}
        <HStack className="kb-actions" gap={3} align="center" px={2} wrap="wrap" justify="center" pb={4}>
          {(() => {
            const pillRolls = isMyTurn && gameState.phase === 'rolling' && !diceAnim;
            return (
              <Box
                as={pillRolls ? 'button' : 'div'}
                onClick={pillRolls ? handleRoll : undefined}
                cursor={pillRolls ? 'pointer' : 'default'}
                px={3} py={1.5} borderRadius="full"
                transition="background 0.2s ease"
                style={{
                  background: isMyTurn ? '#38a169' : 'var(--chakra-colors-surface-subtle)',
                  boxShadow: pillRolls ? '0 2px 12px rgba(56,161,105,0.55)' : 'none',
                }}
              >
                <Text fontSize="sm" fontWeight="700" className="kb-status" style={{ color: isMyTurn ? 'white' : 'var(--chakra-colors-text-muted)' }}>
                  {pillRolls ? '🎲 ' : ''}{statusMsg()}
                </Text>
              </Box>
            );
          })()}
          {/* Oda kodu — yanlışlıkla çıkan aynı kodla geri girebilsin; tıklayınca kopyalanır */}
          <Box
            as="button"
            title="Oda kodunu kopyala"
            cursor="pointer"
            px={2.5} py={1} borderRadius="full" bg="surface.subtle"
            borderWidth="1px" borderColor="border.subtle"
            onClick={() => {
              navigator.clipboard?.writeText(code).catch(() => {});
              setCodeCopied(true);
              setTimeout(() => setCodeCopied(false), 1500);
            }}
          >
            <Text fontSize="xs" fontFamily="mono" fontWeight="700" letterSpacing="wider" color={codeCopied ? 'green.400' : 'text.muted'}>
              {codeCopied ? '✓ Kopyalandı' : `🔑 ${code}`}
            </Text>
          </Box>
          {gameState.winner && (
            <Button colorPalette="brand" onClick={() => leaveToHome(true)}>Yeni Oyun</Button>
          )}
          <Button variant="ghost" colorPalette="red" size="sm" onClick={() => leaveToHome()}>Çık</Button>
        </HStack>
      </VStack>

      {/* Kazanan overlay */}
      {gameState.winner && (
        <Box position="fixed" inset={0} zIndex={200} bg="rgba(0,0,0,0.82)"
          display="flex" flexDir="column" alignItems="center" justifyContent="center" gap={4} px={6}>
          <Text fontSize="6xl">🏆</Text>
          <Text fontSize="2xl" fontWeight="900" color="white" textAlign="center">
            {gameState.winner === myColor ? 'Kazandın!' : `${nameOf(gameState.winner)} kazandı`}
          </Text>
          <Button colorPalette="brand" size="lg" onClick={() => leaveToHome(true)}>Yeni Oyun / Odaya Dön</Button>
        </Box>
      )}
    </Box>
  );
}
