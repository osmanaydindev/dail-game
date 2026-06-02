'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, VStack, HStack, Text, Button, Input, Alert, Spinner, SimpleGrid,
} from '@chakra-ui/react';
import type { Socket } from 'socket.io-client';
import { createKizmaBiraderSocket } from '@/lib/socket';
import { KizmaBoard } from './KizmaBoard';
import {
  KIZMA_COLORS, COLOR_HEX, COLOR_LABEL_TR,
} from './types';
import type {
  KizmaColor, KizmaGameState, KizmaMove, LobbyPayload, GamePlayerInfo,
} from './types';

const STORAGE_KEY = 'kizma-room';

interface Props {
  user: { _id: string; displayName: string };
}

type Screen = 'home' | 'lobby' | 'game';

export function KizmaBiraderGame({ user }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const rejoinRef = useRef(false);

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
  const [animDie, setAnimDie] = useState<number | null>(null);

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = createKizmaBiraderSocket();
    socketRef.current = s;

    s.on('kizma:created', ({ code: c }: { code: string }) => {
      setCode(c); setScreen('lobby'); setBusy(false);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code: c }));
    });
    s.on('kizma:joined', ({ code: c }: { code: string }) => {
      setCode(c); setScreen('lobby'); setBusy(false);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code: c }));
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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code: p.code }));
      setGameState(p.state); setMyColor(p.myColor); setGamePlayers(p.players);
      setLegalMoves(p.legalMoves); setScreen('game'); setBusy(false);
    });
    s.on('kizma:reconnected', (p: {
      state: KizmaGameState; myColor: KizmaColor | null; code: string;
      players: GamePlayerInfo[]; legalMoves: KizmaMove[];
    }) => {
      rejoinRef.current = false;
      setGameState(p.state); setMyColor(p.myColor); setGamePlayers(p.players);
      setLegalMoves(p.legalMoves); setCode(p.code); setScreen('game');
    });
    s.on('kizma:state', (p: { state: KizmaGameState; legalMoves: KizmaMove[] }) => {
      setGameState(p.state); setLegalMoves(p.legalMoves);
    });
    s.on('kizma:dice', ({ die }: { die: number; by: KizmaColor }) => {
      // kısa zar animasyonu
      let ticks = 0;
      const iv = setInterval(() => {
        setAnimDie(Math.ceil(Math.random() * 6));
        if (++ticks >= 6) { clearInterval(iv); setAnimDie(null); }
      }, 60);
    });
    s.on('kizma:error', ({ message }: { message: string }) => {
      if (rejoinRef.current) { rejoinRef.current = false; sessionStorage.removeItem(STORAGE_KEY); }
      setError(message); setBusy(false);
      setTimeout(() => setError(null), 3000);
    });
    s.on('connect_error', () => { setError('Sunucuya bağlanılamadı.'); setBusy(false); });

    s.on('connect', () => {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const { code: c } = JSON.parse(raw) as { code: string };
          rejoinRef.current = true;
          s.emit('kizma:rejoin', { code: c });
        } catch { sessionStorage.removeItem(STORAGE_KEY); }
      }
    });

    return () => { s.disconnect(); };
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

  const me = lobby?.players.find((p) => p.displayName === user.displayName);
  const amHost = !!me?.isHost;

  const leaveToHome = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setScreen('home'); setLobby(null); setGameState(null); setMyColor(null);
    setGamePlayers([]); setCode(''); setJoinInput(''); setLegalMoves([]);
  };

  // ── HOME: oda oluştur / katıl ─────────────────────────────────────────────────
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

  // ── LOBBY: renk seç / hazır / başlat ──────────────────────────────────────────
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

        {/* Renk seçimi */}
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

        {/* Oyuncular */}
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

        {/* Aksiyonlar */}
        <HStack w="full" gap={3}>
          <Button
            flex={1}
            colorPalette={me?.ready ? 'gray' : 'green'}
            variant={me?.ready ? 'outline' : 'solid'}
            disabled={!me?.color}
            onClick={() => emit('kizma:ready', { ready: !me?.ready })}
          >
            {me?.ready ? 'Hazır değilim' : 'Hazırım'}
          </Button>
          {amHost && (
            <Button flex={1} colorPalette="brand" disabled={!lobby?.canStart} onClick={handleStart}>
              Başlat
            </Button>
          )}
        </HStack>
        <Button variant="ghost" size="sm" color="text.muted" onClick={leaveToHome}>Odadan çık</Button>
      </VStack>
    );
  }

  // ── GAME ──────────────────────────────────────────────────────────────────────
  if (!gameState) return <Box display="flex" justifyContent="center" pt={20}><Spinner /></Box>;

  const isMyTurn = gameState.turn === myColor && !gameState.winner;
  const nameOf = (c: KizmaColor) => gamePlayers.find((p) => p.color === c)?.displayName ?? c;
  const finishedCount = (c: KizmaColor) =>
    gameState.players.find((p) => p.color === c)?.tokens.filter((t) => t.pos === 57).length ?? 0;

  const statusMsg = () => {
    if (gameState.winner) return gameState.winner === myColor ? '🏆 Kazandın!' : `${nameOf(gameState.winner)} kazandı`;
    if (isMyTurn) return gameState.phase === 'rolling' ? 'Zarını at!' : 'Taşını seç';
    return `${nameOf(gameState.turn)} oynuyor...`;
  };

  const dieFace = animDie ?? gameState.dice;

  return (
    <Box className="kb-container" position="relative" w="full" bg="surface">
      <VStack className="kb-stack" gap={3} align="center" w="full">
        {error && (
          <Alert.Root status="error" borderRadius="lg" maxW="600px" w="full" mx={{ base: 3, md: 0 }}>
            <Alert.Indicator /><Alert.Title fontSize="sm">{error}</Alert.Title>
          </Alert.Root>
        )}

        {/* Üst bilgi şeridi: oyuncular + bitirdikleri */}
        <HStack className="kb-playerbar" justify="center" gap={3} w="full" maxW={{ base: '100%', md: '640px' }} px={{ base: 3, md: 0 }} wrap="wrap">
          {gameState.activeColors.map((c) => (
            <HStack key={c} gap={1.5} opacity={gameState.turn === c ? 1 : 0.55}>
              <Box w="13px" h="13px" borderRadius="full" bg={COLOR_HEX[c]} borderWidth="1px" borderColor="border.subtle" />
              <Text fontSize="xs" fontWeight={gameState.turn === c ? '800' : '500'}>{nameOf(c)}</Text>
              <Text fontSize="2xs" color="text.muted">{finishedCount(c)}/4</Text>
            </HStack>
          ))}
        </HStack>

        {/* Board — kare, viewport'a sığar */}
        <Box
          className="kb-board-wrap"
          w="full"
          maxW={{ base: '100vw', md: '560px' }}
          aspectRatio={1}
          mx="auto"
        >
          <KizmaBoard
            state={gameState}
            myColor={myColor}
            legalMoves={legalMoves}
            isMyTurn={isMyTurn}
            onTokenClick={handleTokenClick}
          />
        </Box>

        {/* Aksiyon: durum + zar */}
        <HStack className="kb-actions" gap={4} align="center">
          <Text fontSize="sm" fontWeight="700" color={isMyTurn ? 'green.400' : 'text.muted'} className="kb-status">
            {statusMsg()}
          </Text>
          {dieFace != null && (
            <Box
              className="kb-die"
              w="44px" h="44px" borderRadius="lg" bg="white" color="#11161d"
              display="flex" alignItems="center" justifyContent="center"
              fontSize="2xl" fontWeight="900" boxShadow="0 2px 8px rgba(0,0,0,0.3)"
            >
              {dieFace}
            </Box>
          )}
          {isMyTurn && gameState.phase === 'rolling' && (
            <Button colorPalette="brand" size="lg" onClick={handleRoll} className="kb-roll">
              🎲 Zar At
            </Button>
          )}
          {gameState.winner && (
            <Button colorPalette="brand" onClick={leaveToHome}>Yeni Oyun</Button>
          )}
        </HStack>
      </VStack>

      {/* Kazanan overlay */}
      {gameState.winner && (
        <Box position="fixed" inset={0} zIndex={200} bg="rgba(0,0,0,0.82)" display="flex" flexDir="column" alignItems="center" justifyContent="center" gap={4} px={6}>
          <Text fontSize="6xl">🏆</Text>
          <Text fontSize="2xl" fontWeight="900" color="white" textAlign="center">
            {gameState.winner === myColor ? 'Kazandın!' : `${nameOf(gameState.winner)} kazandı`}
          </Text>
          <Button colorPalette="brand" size="lg" onClick={leaveToHome}>Yeni Oyun / Odaya Dön</Button>
        </Box>
      )}
    </Box>
  );
}
