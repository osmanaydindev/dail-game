'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, VStack, HStack, Text, Button, Input, Alert, Spinner,
} from '@chakra-ui/react';

// ── Portrait mobile detection ─────────────────────────────────────────────────
function usePortraitMobile() {
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsPortrait(
        typeof window !== 'undefined' &&
        window.innerWidth < 600 &&
        window.innerHeight > window.innerWidth,
      );
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return isPortrait;
}
import { TavlaBoard } from './TavlaBoard';
import type { GameState, Move, Color, PlayerInfo } from './types';
import { createTavlaSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

// ── Sounds via Web Audio API ──────────────────────────────────────────────────
function playMoveSound() {
  try {
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.09), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 55) * 0.65;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 380;
    filter.Q.value = 0.9;
    src.connect(filter);
    filter.connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close(), 400);
  } catch {}
}

function playHitSound() {
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

function playDiceSound() {
  try {
    const actx = new AudioContext();
    // Clatter clicks at increasing intervals
    const times = [0, 0.07, 0.13, 0.19, 0.27, 0.37, 0.49, 0.63, 0.79, 0.97, 1.17];
    times.forEach(t => {
      const buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * 0.025), actx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
      const src = actx.createBufferSource();
      src.buffer = buf;
      const gain = actx.createGain();
      gain.gain.setValueAtTime(0.5, actx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + t + 0.025);
      src.connect(gain);
      gain.connect(actx.destination);
      src.start(actx.currentTime + t);
    });
    setTimeout(() => actx.close(), 1800);
  } catch {
    // AudioContext not available — silently skip
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLegalMoves(state: GameState, myColor: Color): Move[] {
  if (state.phase !== 'moving' || state.turn !== myColor) return [];
  const { board, bar, movesLeft } = state;
  const unique = [...new Set(movesLeft)];
  const moves: Move[] = [];

  const myCount = (idx: number) =>
    myColor === 'white' ? Math.max(0, board[idx]) : Math.max(0, -board[idx]);
  const blocked = (idx: number) =>
    myColor === 'white' ? board[idx] <= -2 : board[idx] >= 2;

  const allInHome = () => {
    if (bar[myColor] > 0) return false;
    const [lo, hi] = myColor === 'white' ? [0, 6] : [18, 24];
    let cnt = 0;
    for (let i = lo; i < hi; i++) cnt += myCount(i);
    return cnt === 15 - state.borneOff[myColor];
  };

  const furthest = () => {
    if (myColor === 'white') {
      for (let i = 5; i >= 0; i--) if (board[i] > 0) return i;
    } else {
      for (let i = 18; i < 24; i++) if (board[i] < 0) return i;
    }
    return -1;
  };

  if (bar[myColor] > 0) {
    for (const die of unique) {
      const entry = myColor === 'white' ? 24 - die : die - 1;
      if (!blocked(entry)) moves.push({ from: 'bar', to: entry, die });
    }
    return moves;
  }

  const canBO = allInHome();
  for (const die of unique) {
    for (let i = 0; i < 24; i++) {
      if (myCount(i) === 0) continue;
      const to = myColor === 'white' ? i - die : i + die;
      if (canBO) {
        if (myColor === 'white' && i <= 5) {
          if (to === -1) { moves.push({ from: i, to: 'off', die }); continue; }
          if (to < -1 && furthest() === i) { moves.push({ from: i, to: 'off', die }); continue; }
        }
        if (myColor === 'black' && i >= 18) {
          if (to === 24) { moves.push({ from: i, to: 'off', die }); continue; }
          if (to > 24 && furthest() === i) { moves.push({ from: i, to: 'off', die }); continue; }
        }
      }
      if (to < 0 || to >= 24) continue;
      if (!blocked(to)) moves.push({ from: i, to, die });
    }
  }
  return moves;
}

// ── Lobby ─────────────────────────────────────────────────────────────────────
function Lobby({
  onCreateRoom,
  onJoinRoom,
  onCancelWaiting,
  createdCode,
  error,
  joining,
  matchTarget,
  onMatchTargetChange,
}: {
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onCancelWaiting: () => void;
  createdCode: string | null;
  error: string | null;
  joining: boolean;
  matchTarget: number;
  onMatchTargetChange: (n: number) => void;
}) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!createdCode) return;
    navigator.clipboard.writeText(createdCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (createdCode) {
    return (
      <VStack gap={6} maxW="360px" mx="auto" pt={8} px={4}>
        <Box textAlign="center">
          <Text fontSize="2xl" fontWeight="800" mb={1}>Tavla</Text>
        </Box>
        <Box w="full" bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" p={6} textAlign="center">
          <Spinner size="sm" mb={3} />
          <Text fontWeight="700" mb={1}>Rakip bekleniyor...</Text>
          <Text fontSize="xs" color="text.muted" mb={4}>Bu kodu rakibine gönder</Text>
          <Text fontSize="3xl" fontWeight="900" fontFamily="mono" letterSpacing="widest" mb={4}>
            {createdCode}
          </Text>
          <Button w="full" colorPalette="brand" variant="solid" size="md" onClick={copyCode} mb={3}>
            {copied ? '✓ Kopyalandı!' : '📋 Kodu Kopyala'}
          </Button>
          <Button w="full" variant="outline" colorPalette="red" size="sm" onClick={onCancelWaiting}>
            İptal Et
          </Button>
        </Box>
      </VStack>
    );
  }

  return (
    <VStack gap={6} maxW="360px" mx="auto" pt={8} px={4}>
      <Box textAlign="center">
        <Text fontSize="2xl" fontWeight="800" mb={1}>Tavla</Text>
        <Text fontSize="sm" color="text.muted">Oda oluştur veya oda kodunu girerek katıl</Text>
      </Box>

      {error && (
        <Alert.Root status="error" borderRadius="lg" w="full">
          <Alert.Indicator />
          <Alert.Title fontSize="sm">{error}</Alert.Title>
        </Alert.Root>
      )}

      <Box w="full" bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" p={5}>
        <Text fontWeight="700" mb={2}>Yeni Oda Oluştur</Text>
        <Text fontSize="xs" color="text.muted" mb={2}>Maç hedefi (o puana ilk ulaşan maçı kazanır):</Text>
        <HStack gap={2} mb={3}>
          {[1, 3, 5, 7].map(n => (
            <Button key={n} size="sm" flex="1"
              variant={matchTarget === n ? 'solid' : 'outline'}
              colorPalette="brand"
              onClick={() => onMatchTargetChange(n)}
            >{n} Puan</Button>
          ))}
        </HStack>
        <Button w="full" colorPalette="brand" variant="solid" onClick={onCreateRoom} loading={joining}>
          Oda Oluştur
        </Button>
      </Box>

      <Box w="full" bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" p={5}>
        <Text fontWeight="700" mb={3}>Odaya Katıl</Text>
        <HStack>
          <Input
            placeholder="Oda kodu"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            fontFamily="mono"
            fontSize="lg"
            fontWeight="700"
            letterSpacing="widest"
          />
          <Button
            colorPalette="brand"
            variant="outline"
            onClick={() => onJoinRoom(code)}
            disabled={code.length !== 6}
            loading={joining}
          >
            Katıl
          </Button>
        </HStack>
      </Box>
    </VStack>
  );
}


// ── Player card bileşeni ──────────────────────────────────────────────────────
function PlayerCard({
  name, borneOff, isActive, color, statusMsg,
}: {
  name: string; borneOff: number; isActive: boolean; color: Color; statusMsg?: string;
}) {
  const checkerColor = color === 'white' ? '#f0ece0' : '#c0392b';
  return (
    <HStack
      className="tavla-player-card"
      px={3} py={2} borderRadius="xl" justify="space-between" w="full"
      style={{
        background: isActive ? `${checkerColor}18` : 'transparent',
        border: `1.5px solid ${isActive ? checkerColor : 'transparent'}`,
        boxShadow: isActive ? `0 0 14px ${checkerColor}44` : 'none',
        transition: 'all 0.25s',
      }}
    >
      <HStack gap={2}>
        <Box
          w="12px" h="12px" borderRadius="full" flexShrink={0}
          style={{ background: checkerColor, border: '1.5px solid rgba(0,0,0,0.25)', boxShadow: `0 1px 4px ${checkerColor}66` }}
        />
        <Text fontSize="sm" fontWeight="700">{name}</Text>
        <Text fontSize="xs" color="text.muted">({borneOff}/15)</Text>
      </HStack>
      {statusMsg && (
        <Box
          px={3} py={0.5} borderRadius="full"
          style={{ background: isActive ? '#22c55e' : undefined }}
          bg={isActive ? undefined : 'surface.subtle'}
        >
          <Text fontSize="xs" fontWeight="700" color={isActive ? 'white' : 'text.muted'}>
            {statusMsg}
          </Text>
        </Box>
      )}
    </HStack>
  );
}

// ── Main game component ───────────────────────────────────────────────────────
interface TavlaGameProps {
  user: { _id: string; displayName: string };
}

const STORAGE_KEY = 'tavla-room';
const storage = typeof window !== 'undefined' ? localStorage : null;

export function TavlaGame({ user }: TavlaGameProps) {
  const isPortraitMobile = usePortraitMobile();
  // "Yine de oyna" tıklandığında overlay'i gizle; aynı oturumda tekrar gösterme
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const animatingRef = useRef(false);
  const pendingStateRef = useRef<GameState | null>(null);
  const rejoinAttemptRef = useRef(false);
  const prevStateRef = useRef<GameState | null>(null);
  const prevTurnRef = useRef<Color | null>(null);
  const justMovedRef = useRef(false);
  const myColorRef = useRef<Color>('white');
  const containerRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<'lobby' | 'waiting' | 'playing'>('lobby');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myColor, setMyColor] = useState<Color>('white');
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | 'bar' | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [joining, setJoining] = useState(false);
  const [animDice, setAnimDice] = useState<number[] | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTurnNotif, setShowTurnNotif] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsSupported, setFsSupported] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Match state
  const [matchTarget, setMatchTarget] = useState<number>(1);
  const [scores, setScores] = useState<{ white: number; black: number }>({ white: 0, black: 0 });
  const [matchWinner, setMatchWinner] = useState<Color | null>(null);
  const [lastIsMars, setLastIsMars] = useState(false);

  // Keep myColorRef in sync so animation callbacks can read current color
  useEffect(() => { myColorRef.current = myColor; }, [myColor]);

  // ── Fullscreen (hide the browser URL bar like a video) ──────────────────────
  // Element fullscreen works on Android/desktop Chrome; iOS Safari does not
  // support it for non-video elements, so we hide the button there.
  useEffect(() => {
    setFsSupported(typeof document !== 'undefined' && !!document.fullscreenEnabled);
    const onFs = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) { try { (screen.orientation as { unlock?: () => void })?.unlock?.(); } catch { /* ignore */ } }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
        .then(() => {
          // Best-effort: rotate to landscape and keep it (Android only).
          (screen.orientation as { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => {});
        })
        .catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Cleanup disconnect timer on unmount
  useEffect(() => {
    return () => {
      if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
    };
  }, []);

  // ── Dice animation ─────────────────────────────────────────────────────────
  const startDiceAnimation = useCallback((finalState: GameState) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setIsAnimating(true);
    pendingStateRef.current = finalState;
    playDiceSound();

    // Frame delays: fast→slow (ms between frames)
    const deltas = [45, 55, 65, 80, 95, 115, 140, 165, 195, 230, 0];
    let elapsed = 0;
    deltas.forEach((delta, i) => {
      elapsed += delta;
      setTimeout(() => {
        if (i < deltas.length - 1) {
          setAnimDice([
            Math.ceil(Math.random() * 6),
            Math.ceil(Math.random() * 6),
          ]);
        } else {
          // Animation done — apply real state
          setAnimDice(null);
          setIsAnimating(false);
          animatingRef.current = false;
          const s = pendingStateRef.current!;
          prevStateRef.current = s;
          prevPhaseRef.current = s.phase;
          // Show "Sıra Sende" when turn switches to us
          if (s.turn === myColorRef.current && prevTurnRef.current !== myColorRef.current && s.phase === 'rolling') {
            setShowTurnNotif(true);
            setTimeout(() => setShowTurnNotif(false), 2200);
          }
          prevTurnRef.current = s.turn;
          setGameState(s);
          setSelected(null);
          setValidMoves([]);
        }
      }, elapsed);
    });
  }, []);

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const s = createTavlaSocket();
    socketRef.current = s;

    s.on('tavla:created', ({ code }: { code: string }) => {
      storage?.setItem(STORAGE_KEY, JSON.stringify({ code }));
      setCreatedCode(code);
      setPhase('waiting');
      setJoining(false);
    });

    s.on('tavla:game_start', ({
      state,
      myColor: mc,
      players: pl,
      code,
      matchTarget: mt,
      scores: sc,
    }: { state: GameState; myColor: Color; players: PlayerInfo[]; code: string; matchTarget?: number; scores?: { white: number; black: number } }) => {
      storage?.setItem(STORAGE_KEY, JSON.stringify({ code, color: mc }));
      prevPhaseRef.current = state.phase;
      prevStateRef.current = state;
      prevTurnRef.current = state.turn;
      setGameState(state);
      setMyColor(mc);
      setPlayers(pl);
      setMatchTarget(mt ?? 1);
      setScores(sc ?? { white: 0, black: 0 });
      setMatchWinner(null);
      setLastIsMars(false);
      setPhase('playing');
    });

    s.on('tavla:reconnected', ({
      state,
      myColor: mc,
      players: pl,
      code,
      matchTarget: mt,
      scores: sc,
    }: { state: GameState; myColor: Color; players: PlayerInfo[]; code: string; matchTarget?: number; scores?: { white: number; black: number } }) => {
      rejoinAttemptRef.current = false;
      storage?.setItem(STORAGE_KEY, JSON.stringify({ code, color: mc }));
      prevPhaseRef.current = state.phase;
      prevStateRef.current = state;
      prevTurnRef.current = state.turn;
      setGameState(state);
      setMyColor(mc);
      setPlayers(pl);
      setMatchTarget(mt ?? 1);
      setScores(sc ?? { white: 0, black: 0 });
      setPhase('playing');
      setJoining(false);
    });

    s.on('tavla:state', ({ state }: { state: GameState }) => {
      const prevPhase = prevPhaseRef.current;
      // Detect dice roll: dice just appeared and previous phase was rolling
      if (state.dice.length > 0 && prevPhase === 'rolling' && !animatingRef.current) {
        prevPhaseRef.current = state.phase;
        startDiceAnimation(state);
      } else if (!animatingRef.current) {
        const prev = prevStateRef.current;
        // Detect opponent move sounds
        if (prev) {
          const boardChanged =
            state.board.some((v, i) => v !== prev.board[i]) ||
            state.borneOff.white !== prev.borneOff.white ||
            state.borneOff.black !== prev.borneOff.black ||
            state.bar.white !== prev.bar.white ||
            state.bar.black !== prev.bar.black;

          if (boardChanged && !justMovedRef.current) {
            const hitHappened = state.bar.white > prev.bar.white || state.bar.black > prev.bar.black;
            hitHappened ? playHitSound() : playMoveSound();
          }
          justMovedRef.current = false;
        }
        prevStateRef.current = state;
        prevPhaseRef.current = state.phase;
        setGameState(state);
        setSelected(null);
        setValidMoves([]);
      }
    });

    s.on('tavla:game_ended', ({
      state, scores: sc, isMars,
    }: { state: GameState; scores: { white: number; black: number }; isMars: boolean; lastWinner: Color }) => {
      prevStateRef.current = state;
      prevPhaseRef.current = state.phase;
      setGameState(state);
      setScores(sc);
      setLastIsMars(isMars);
    });

    s.on('tavla:next_game', ({
      state, scores: sc,
    }: { state: GameState; scores: { white: number; black: number } }) => {
      prevPhaseRef.current = state.phase;
      prevStateRef.current = state;
      prevTurnRef.current = state.turn;
      setGameState(state);
      setScores(sc);
      setMatchWinner(null);
      setLastIsMars(false);
      setSelected(null);
      setValidMoves([]);
      setAnimDice(null);
      setIsAnimating(false);
    });

    s.on('tavla:match_over', ({
      scores: sc, winner, isMars,
    }: { scores: { white: number; black: number }; winner: Color; target: number; isMars: boolean }) => {
      setScores(sc);
      setMatchWinner(winner);
      setLastIsMars(isMars);
    });

    s.on('tavla:error', ({ message }: { message: string }) => {
      if (rejoinAttemptRef.current) {
        rejoinAttemptRef.current = false;
        storage?.removeItem(STORAGE_KEY);
      }
      setError(message);
      setTimeout(() => setError(null), 3000);
      setJoining(false);
    });

    s.on('tavla:opponent_left', () => {
      setOpponentLeft(true);
      let secs = 30;
      setDisconnectCountdown(secs);
      disconnectTimerRef.current = setInterval(() => {
        secs -= 1;
        setDisconnectCountdown(secs > 0 ? secs : null);
        if (secs <= 0) {
          clearInterval(disconnectTimerRef.current!);
          disconnectTimerRef.current = null;
        }
      }, 1000);
    });

    s.on('tavla:opponent_reconnected', () => {
      setOpponentLeft(false);
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setDisconnectCountdown(null);
    });

    s.on('connect_error', () => {
      setError('Sunucuya bağlanılamadı.');
      setJoining(false);
    });

    // Attempt rejoin if we have a saved session
    s.on('connect', () => {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const { code } = JSON.parse(raw) as { code: string; color: Color };
          rejoinAttemptRef.current = true;
          s.emit('tavla:rejoin', { code });
        } catch {
          storage?.removeItem(STORAGE_KEY);
        }
      }
    });

    return () => { s.disconnect(); };
  }, [startDiceAnimation]);

  const handleCreateRoom = useCallback(() => {
    setJoining(true);
    setError(null);
    socketRef.current?.emit('tavla:create', { displayName: user.displayName, matchTarget });
  }, [user.displayName, matchTarget]);

  const handleJoinRoom = useCallback((code: string) => {
    setJoining(true);
    setError(null);
    socketRef.current?.emit('tavla:join', { code, displayName: user.displayName });
  }, [user.displayName]);

  const handleRoll = useCallback(() => {
    if (isAnimating) return;
    socketRef.current?.emit('tavla:roll');
  }, [isAnimating]);

  const handleResign = useCallback(() => {
    if (confirm('Oyunu teslim etmek istiyor musun?')) {
      socketRef.current?.emit('tavla:resign');
    }
  }, []);

  const resetToLobby = useCallback(() => {
    storage?.removeItem(STORAGE_KEY);
    setPhase('lobby');
    setGameState(null);
    setCreatedCode(null);
    setOpponentLeft(false);
    setSelected(null);
    setValidMoves([]);
    setScores({ white: 0, black: 0 });
    setMatchWinner(null);
    setLastIsMars(false);
    setAnimDice(null);
    setIsAnimating(false);
    prevPhaseRef.current = null;
  }, []);

  const handleLeaveGame = useCallback(() => {
    const inProgress = gameState && gameState.phase !== 'ended' && !matchWinner;
    if (inProgress) {
      if (!confirm('Maçtan ayrılmak istiyor musun?\nRakibiniz maçı kazanmış sayılır.')) return;
      socketRef.current?.emit('tavla:forfeit');
    }
    resetToLobby();
  }, [gameState, matchWinner, resetToLobby]);

  // ── Point click (select + move) ────────────────────────────────────────────
  const handlePointClick = useCallback((idx: number | 'bar' | 'off') => {
    if (!gameState || gameState.phase !== 'moving' || gameState.turn !== myColor) return;

    // Bear-off click
    if (idx === 'off') {
      if (selected !== null) {
        const offMove = validMoves.find(m => m.from === selected && m.to === 'off');
        if (offMove) {
          playMoveSound();
          justMovedRef.current = true;
          socketRef.current?.emit('tavla:move', offMove);
          setSelected(null);
          setValidMoves([]);
        }
      }
      return;
    }

    const allMoves = getLegalMoves(gameState, myColor);

    // Clicking a valid destination → move
    if (selected !== null) {
      const matchingMoves = allMoves.filter(m =>
        m.from === selected && m.to === idx,
      );
      if (matchingMoves.length > 0) {
        const dest = matchingMoves[0].to;
        const isHit = typeof dest === 'number' && (
          myColor === 'white' ? gameState.board[dest] === -1 : gameState.board[dest] === 1
        );
        isHit ? playHitSound() : playMoveSound();
        justMovedRef.current = true;
        socketRef.current?.emit('tavla:move', matchingMoves[0]);
        setSelected(null);
        setValidMoves([]);
        return;
      }
    }

    // Select a checker
    const isMyChecker = idx === 'bar'
      ? gameState.bar[myColor] > 0
      : (myColor === 'white'
        ? gameState.board[idx as number] > 0
        : gameState.board[idx as number] < 0);

    if (isMyChecker) {
      const movesFromHere = allMoves.filter(m => m.from === idx);
      if (movesFromHere.length > 0) {
        setSelected(idx);
        setValidMoves(movesFromHere);
        return;
      }
    }

    setSelected(null);
    setValidMoves([]);
  }, [gameState, myColor, selected, validMoves]);

  // ── Phase: lobby / waiting ─────────────────────────────────────────────────
  if (phase === 'lobby' || phase === 'waiting') {
    return (
      <Lobby
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onCancelWaiting={resetToLobby}
        createdCode={phase === 'waiting' ? createdCode : null}
        error={error}
        joining={joining}
        matchTarget={matchTarget}
        onMatchTargetChange={setMatchTarget}
      />
    );
  }

  // ── Phase: playing ─────────────────────────────────────────────────────────
  if (!gameState) return <Box display="flex" justifyContent="center" pt={20}><Spinner /></Box>;

  const isMyTurn = gameState.turn === myColor;
  const oppInfo = players.find(p => p.color !== myColor);
  const myInfo = players.find(p => p.color === myColor);
  const flip = myColor === 'black';

  const statusMsg = () => {
    if (gameState.phase === 'ended') {
      const won = gameState.winner === myColor;
      const marsMsg = lastIsMars ? (won ? ' (Mars!)' : ' (Mars yedik!)') : '';
      return won ? `🏆 Kazandın!${marsMsg}` : `😔 Kaybettin${marsMsg}`;
    }
    if (opponentLeft) {
      const secs = disconnectCountdown ?? 30;
      return `Rakip ayrıldı... ${secs}s sonra hükmen kazanırsın`;
    }
    if (isAnimating) return 'Zar atıldı...';
    if (!isMyTurn) return `${oppInfo?.displayName ?? 'Rakip'} oynuyor...`;
    if (gameState.phase === 'rolling') return 'Zarını at!';
    return gameState.movesLeft.length > 0 ? `${gameState.movesLeft.length} hamle hakkın var` : '';
  };

  // Yatay mod overlay'i: oyun sırasında portrait mobilde göster
  const showLandscapeOverlay = isPortraitMobile && !portraitDismissed;

  return (
    <Box ref={containerRef} className="tavla-container" position="relative" w="full" bg="surface">
    {/* Portrait mobile landscape hint overlay */}
    {showLandscapeOverlay && (
      <Box
        position="fixed"
        inset={0}
        zIndex={300}
        bg="rgba(0,0,0,0.93)"
        display="flex"
        flexDir="column"
        alignItems="center"
        justifyContent="center"
        gap={5}
        px={6}
      >
        {/* Animated rotation icon */}
        <Text
          fontSize="6xl"
          style={{
            display: 'inline-block',
            animation: 'tavlaRotateHint 1.6s ease-in-out infinite',
          }}
        >
          📱
        </Text>
        <style>{`
          @keyframes tavlaRotateHint {
            0%   { transform: rotate(0deg); }
            40%  { transform: rotate(-90deg); }
            60%  { transform: rotate(-90deg); }
            100% { transform: rotate(0deg); }
          }
        `}</style>
        <Box textAlign="center">
          <Text fontSize="xl" fontWeight="800" color="white" mb={1}>
            Telefonu Yatay Çevir
          </Text>
          <Text fontSize="sm" color="gray.400" maxW="260px" mx="auto">
            Tavla tahtası yatay ekran için tasarlanmıştır.
            En iyi oyun deneyimi için cihazını yatır.
          </Text>
        </Box>
        <Button
          size="sm"
          variant="ghost"
          color="gray.500"
          mt={2}
          onClick={() => setPortraitDismissed(true)}
        >
          Yine de oyna (küçük ekranda)
        </Button>
      </Box>
    )}

    {/* Turn notification */}
    <Box
      position="fixed"
      bottom="90px"
      left="50%"
      transform={`translateX(-50%) translateY(${showTurnNotif ? '0' : '16px'})`}
      opacity={showTurnNotif ? 1 : 0}
      transition="opacity 0.25s ease, transform 0.25s ease"
      pointerEvents="none"
      zIndex={50}
      bg="green.600"
      color="white"
      px={6}
      py={3}
      borderRadius="full"
      fontWeight="800"
      fontSize="md"
      boxShadow="0 4px 24px rgba(0,0,0,0.35)"
      whiteSpace="nowrap"
    >
      Sıra Sende! 🎲
    </Box>

    <VStack className="tavla-stack" gap={2} align="center" w="full">
      {error && (
        <Alert.Root className="tavla-error" status="error" borderRadius="lg" maxW="600px" w="full" mx={{ base: 3, md: 0 }}>
          <Alert.Indicator />
          <Alert.Title fontSize="sm">{error}</Alert.Title>
        </Alert.Root>
      )}

      {/* Rakip — tahta üstünde */}
      <Box className="tavla-player-top" w="full" maxW={{ base: '100%', md: '720px' }} px={{ base: 3, md: 2 }}>
        <PlayerCard
          name={oppInfo?.displayName ?? 'Rakip'}
          borneOff={gameState.borneOff[myColor === 'white' ? 'black' : 'white']}
          isActive={!isMyTurn && gameState.phase !== 'ended'}
          color={myColor === 'white' ? 'black' : 'white'}
        />
      </Box>

      {/* Board — tam viewport genişliği, köşe yuvarlama sadece desktop'ta */}
      <Box
        className="tavla-board-wrap"
        w="full"
        maxW={{ base: '100vw', md: '720px' }}
        borderRadius={{ base: 'none', md: '2xl' }}
        overflow="hidden"
        borderWidth={{ base: '0', md: '0' }}
        boxShadow={{ base: 'none', md: '0 16px 64px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25)' }}
      >
        <TavlaBoard
          state={gameState}
          myColor={myColor}
          flip={flip}
          selected={selected}
          validMoves={validMoves}
          animDice={animDice}
          dicePos={null}
          onPointClick={handlePointClick}
        />
      </Box>

      {/* Ben — tahta altında */}
      <Box className="tavla-player-bottom" w="full" maxW={{ base: '100%', md: '720px' }} px={{ base: 3, md: 2 }}>
        <PlayerCard
          name={myInfo?.displayName ?? 'Sen'}
          borneOff={gameState.borneOff[myColor]}
          isActive={isMyTurn}
          color={myColor}
          statusMsg={statusMsg()}
        />
      </Box>

      {/* Maç skoru */}
      {matchTarget > 1 && (
        <HStack className="tavla-score-pill" gap={3} py={1} px={4} borderRadius="full" bg="surface.card"
          borderWidth="1px" borderColor="border.subtle">
          <Text fontSize="xs" color="text.muted">Maç</Text>
          <Text fontSize="sm" fontWeight="800">
            {scores[myColor]} — {scores[myColor === 'white' ? 'black' : 'white']}
          </Text>
          <Text fontSize="xs" color="text.muted">{matchTarget}&apos;e kadar</Text>
        </HStack>
      )}

      {/* Landscape-only compact action column (hidden in portrait via CSS) */}
      <Box className="tavla-ls-actions">
        {isMyTurn && gameState.phase === 'rolling' && (
          <Button size="sm" colorPalette="brand" variant="solid"
            onClick={() => handleRoll()} disabled={isAnimating}>
            🎲 Zar At
          </Button>
        )}
        {gameState.phase !== 'ended' && !matchWinner && (
          <Button size="xs" variant="outline" colorPalette="red"
            onClick={handleResign}>
            Teslim Ol
          </Button>
        )}
        <Button size="xs" variant="ghost" colorPalette="red"
          onClick={handleLeaveGame}>
          Ayrıl
        </Button>
        {gameState.phase === 'ended' && matchTarget === 1 && !matchWinner && (
          <Button size="xs" variant="solid" colorPalette="brand"
            onClick={resetToLobby}>
            Yeni Oyun
          </Button>
        )}
      </Box>

      {/* Action buttons (portrait) */}
      <VStack className="tavla-actions" gap={2} w="full" maxW={{ base: '100%', md: '720px' }} px={{ base: 3, md: 2 }}>
        {isMyTurn && gameState.phase === 'rolling' && (
          <Button
            w="full" colorPalette="brand" variant="solid" size="lg"
            onClick={handleRoll} disabled={isAnimating}
            fontSize="xl" fontWeight="800" py={6}
          >
            🎲 Zarını At!
          </Button>
        )}
        {(gameState.phase === 'ended' || matchWinner) ? (
          <Button w="full" variant="solid" colorPalette="brand" size="md" onClick={resetToLobby}>
            {matchWinner ? 'Yeni Maç' : 'Yeni Oyun'}
          </Button>
        ) : null}
        <HStack gap={3} w="full" justify="center">
          {fsSupported && (
            <Button variant="ghost" size="sm" onClick={toggleFullscreen} aria-label="Tam ekran">
              {isFullscreen ? '⛶ Çık' : '⛶ Tam Ekran'}
            </Button>
          )}
          {gameState.phase !== 'ended' && !matchWinner && (
            <Button variant="outline" colorPalette="red" size="sm" onClick={handleResign}>
              Teslim Ol
            </Button>
          )}
          <Button variant="ghost" colorPalette="red" size="sm" onClick={handleLeaveGame}>
            Ayrıl
          </Button>
        </HStack>
      </VStack>
    </VStack>

    {/* Maç bitti overlay */}
    {matchWinner && (
      <Box
        position="fixed"
        inset={0}
        zIndex={200}
        bg="rgba(0,0,0,0.82)"
        display="flex"
        flexDir="column"
        alignItems="center"
        justifyContent="center"
        gap={4}
        px={6}
      >
        <Text fontSize="4xl">{matchWinner === myColor ? '🏆' : '😔'}</Text>
        <Text fontSize="2xl" fontWeight="900" color="white" textAlign="center">
          {matchWinner === myColor ? 'Maçı Kazandın!' : 'Maçı Kaybettin'}
        </Text>
        {lastIsMars && (
          <Box px={4} py={2} borderRadius="full" bg="orange.500">
            <Text fontSize="sm" fontWeight="800" color="white">Mars ile! 🎯</Text>
          </Box>
        )}
        <Text fontSize="lg" fontWeight="700" color="gray.300">
          {scores[myColor]} — {scores[myColor === 'white' ? 'black' : 'white']}
        </Text>
        <Button size="lg" variant="solid" colorPalette="brand" mt={2} onClick={resetToLobby}>
          Yeni Maç
        </Button>
      </Box>
    )}
    </Box>
  );
}
