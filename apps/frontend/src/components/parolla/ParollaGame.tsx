'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, VStack, HStack, Text, Input, Spinner, Alert } from '@chakra-ui/react';
import { api } from '@/lib/api';
import { todayLocal } from '@/lib/date';
import { getDailyQuestions, checkAnswer } from '@/lib/parollaData';
import { useAuthStore } from '@/store/authStore';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '@dail-game/types';

// ─── Types ────────────────────────────────────────────────────────────────────
type LetterStatus = 'unanswered' | 'correct' | 'wrong' | 'skipped';

interface LetterResult {
  letter: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
  status: LetterStatus;
}

interface SavedState {
  date: string;
  results: LetterResult[];
  currentIdx: number;
  timeLeft: number;
  gameStatus: 'playing' | 'finished';
  submitted: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GAME_DURATION = 300;
const storageKey = (userId: string) => `parolla-game-state-${userId}`;

const STATUS_BG: Record<LetterStatus, string> = {
  correct:    '#538d4e',
  wrong:      '#c0392b',
  skipped:    '#c9a227',
  unanswered: '',
};

function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Sounds ───────────────────────────────────────────────────────────────────
function playCorrectSound() {
  try {
    const ctx = new AudioContext();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
    setTimeout(() => ctx.close(), 900);
  } catch {}
}

function playWrongSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

function playSkipSound() {
  try {
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.18), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / ctx.sampleRate) * 22) * 0.45;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.18);
    filter.Q.value = 2;
    src.connect(filter);
    filter.connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close(), 400);
  } catch {}
}

// ─── Inline answer key (revisit view) ────────────────────────────────────────
function InlineAnswerKey({
  results,
  onShowStats,
}: {
  results: LetterResult[];
  onShowStats: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const icon = (s: LetterStatus) =>
    s === 'correct' ? '✓' : s === 'wrong' ? '✗' : s === 'skipped' ? '→' : '–';
  const iconColor = (s: LetterStatus) =>
    s === 'correct' ? '#538d4e' : s === 'wrong' ? '#c0392b' : s === 'skipped' ? '#c9a227' : 'text.muted';

  return (
    <Box px={4} w="full" maxW="480px" mx="auto" pb={6}>
      <HStack justify="space-between" mb={3} mt={4}>
        <Text fontWeight="800" fontSize="sm" color="text.muted" letterSpacing="wider">
          CEVAP ANAHTARI
        </Text>
        <Box
          as="button"
          fontSize="xs"
          color="text.muted"
          textDecoration="underline"
          cursor="pointer"
          onClick={onShowStats}
        >
          İstatistikleri gör
        </Box>
      </HStack>

      <VStack gap={0} align="stretch" borderTopWidth="1px" borderColor="border.subtle">
        {results.map(r => (
          <Box
            key={r.letter}
            borderBottomWidth="1px"
            borderColor="border.subtle"
            cursor="pointer"
            onClick={() => setExpanded(prev => prev === r.letter ? null : r.letter)}
            _hover={{ bg: 'surface.subtle' }}
            transition="background 0.1s"
          >
            <HStack py={3} px={1} justify="space-between">
              <HStack gap={3}>
                <Text w="18px" fontWeight="800" fontSize="md" color={iconColor(r.status)}>
                  {icon(r.status)}
                </Text>
                <VStack gap={0} align="start">
                  <Text fontSize="sm" fontWeight="700">
                    {r.correctAnswer.toLocaleUpperCase('tr-TR')}
                  </Text>
                  <Text fontSize="xs" color="text.muted"
                    overflow="hidden"
                    style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}
                  >
                    {r.question}
                  </Text>
                </VStack>
              </HStack>
              <HStack gap={2} flexShrink={0}>
                <Text fontSize="sm" color="text.muted" fontWeight="700">{r.letter}</Text>
                <Text fontSize="xs" color="text.muted">{expanded === r.letter ? '▲' : '▼'}</Text>
              </HStack>
            </HStack>

            {expanded === r.letter && (
              <Box px={1} pb={3}>
                <Box bg="surface.subtle" borderRadius="lg" p={3} borderWidth="1px" borderColor="border.subtle">
                  <Text fontSize="xs" color="text.muted" mb={1}>Soru</Text>
                  <Text fontSize="sm" fontWeight="600" mb={3}>{r.question}</Text>
                  <Text fontSize="xs" color="text.muted" mb={1}>Verilen cevap</Text>
                  <Text fontSize="sm" fontWeight="600" color={iconColor(r.status) !== 'text.muted' ? iconColor(r.status) : undefined}>
                    {r.userAnswer ? r.userAnswer.toLocaleUpperCase('tr-TR') : '—'}
                  </Text>
                </Box>
              </Box>
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

// ─── Ready modal (başlamadan önce onay) ──────────────────────────────────────
function ReadyModal({ onStart }: { onStart: () => void }) {
  return (
    <Box
      position="fixed"
      inset={0}
      bg="rgba(0,0,0,0.7)"
      zIndex={200}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        bg="surface.card"
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="border.subtle"
        w="full"
        maxW="400px"
        p={6}
        textAlign="center"
      >
        <Text fontSize="2xl" mb={2}>⏱</Text>
        <Text fontWeight="800" fontSize="xl" mb={2}>Hazır mısın?</Text>
        <Text fontSize="sm" color="text.muted" mb={6}>
          Başladığında {Math.floor(GAME_DURATION / 60)} dakikalık süre işlemeye başlar.
          Her harf için o harfle başlayan kelimeyi yaz veya pas geç.
        </Text>
        <Box
          as="button"
          w="full"
          py={3}
          borderRadius="xl"
          bg="green.600"
          color="white"
          fontWeight="700"
          fontSize="sm"
          cursor="pointer"
          _hover={{ opacity: 0.9 }}
          _active={{ opacity: 0.7 }}
          onClick={onStart}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Başla
        </Box>
      </Box>
    </Box>
  );
}

// ─── Result modal ─────────────────────────────────────────────────────────────
function ResultModal({
  results,
  timeExpired,
  onClose,
}: {
  results: LetterResult[];
  timeExpired: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'stats' | 'answers'>('answers');
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (letter: string) =>
    setExpanded(prev => (prev === letter ? null : letter));

  const correct = results.filter(r => r.status === 'correct').length;
  const wrong   = results.filter(r => r.status === 'wrong').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const blank   = results.filter(r => r.status === 'unanswered').length;

  const icon = (s: LetterStatus) =>
    s === 'correct' ? '✓' : s === 'wrong' ? '✗' : s === 'skipped' ? '→' : '';
  const iconColor = (s: LetterStatus) =>
    s === 'correct' ? '#538d4e' : s === 'wrong' ? '#c0392b' : s === 'skipped' ? '#c9a227' : 'inherit';

  return (
    <Box
      position="fixed"
      inset={0}
      bg="rgba(0,0,0,0.7)"
      zIndex={200}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        bg="surface.card"
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="border.subtle"
        w="full"
        maxW="480px"
        maxH="85vh"
        display="flex"
        flexDir="column"
        overflow="hidden"
      >
        {/* Header */}
        <Box p={5} borderBottomWidth="1px" borderColor="border.subtle" textAlign="center">
          <Text fontWeight="800" fontSize="lg">Bugünün istatistiği</Text>
        </Box>

        {/* Tabs */}
        <HStack gap={0} borderBottomWidth="1px" borderColor="border.subtle">
          {(['stats', 'answers'] as const).map(t => (
            <Box
              key={t}
              flex={1}
              py={3}
              textAlign="center"
              cursor="pointer"
              fontSize="sm"
              fontWeight={tab === t ? '700' : '400'}
              color={tab === t ? undefined : 'text.muted'}
              borderBottomWidth={tab === t ? '2px' : '0'}
              borderColor="red.400"
              onClick={() => setTab(t)}
            >
              {t === 'stats' ? 'Skor dağılımı' : 'Cevap anahtarı'}
            </Box>
          ))}
        </HStack>

        {/* Body */}
        <Box flex={1} overflowY="auto" p={4}>
          {tab === 'stats' ? (
            <VStack gap={4} py={2}>
              {[
                { label: 'Doğru', count: correct, color: '#538d4e' },
                { label: 'Yanlış', count: wrong,   color: '#c0392b' },
                { label: 'Pas',    count: skipped,  color: '#c9a227' },
                { label: 'Boş',    count: blank,    color: 'text.muted' },
              ].map(({ label, count, color }) => (
                <HStack key={label} w="full" justify="space-between">
                  <Text fontSize="sm" color="text.muted">{label}</Text>
                  <Text fontWeight="700" color={color}>{count}</Text>
                </HStack>
              ))}
            </VStack>
          ) : (
            <VStack gap={0} align="stretch">
              {results.map(r => (
                <Box
                  key={r.letter}
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                  cursor="pointer"
                  onClick={() => toggle(r.letter)}
                  _hover={{ bg: 'surface.subtle' }}
                  transition="background 0.1s"
                >
                  {/* Ana satır */}
                  <HStack py={3} px={1} justify="space-between">
                    <HStack gap={3}>
                      <Text w="18px" fontWeight="800" fontSize="md" color={iconColor(r.status)}>
                        {icon(r.status)}
                      </Text>
                      <Text fontSize="sm" fontWeight="600">
                        {r.correctAnswer.toLocaleUpperCase('tr-TR')}
                      </Text>
                    </HStack>
                    <HStack gap={2} flexShrink={0}>
                      <Text fontSize="sm" color="text.muted" fontWeight="700">{r.letter}</Text>
                      <Text fontSize="xs" color="text.muted">
                        {expanded === r.letter ? '▲' : '▼'}
                      </Text>
                    </HStack>
                  </HStack>

                  {/* Açılır detay */}
                  {expanded === r.letter && (
                    <Box px={1} pb={3}>
                      <Box
                        bg="surface.subtle"
                        borderRadius="lg"
                        p={3}
                        borderWidth="1px"
                        borderColor="border.subtle"
                      >
                        <Text fontSize="xs" color="text.muted" mb={1}>Soru</Text>
                        <Text fontSize="sm" fontWeight="600" mb={3}>
                          {r.question}
                        </Text>
                        <Text fontSize="xs" color="text.muted" mb={1}>Verilen cevap</Text>
                        <Text
                          fontSize="sm"
                          fontWeight="600"
                          color={iconColor(r.status) || 'text.muted'}
                        >
                          {r.userAnswer
                            ? r.userAnswer.toLocaleUpperCase('tr-TR')
                            : '—'}
                        </Text>
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>
          )}
        </Box>

        {/* Footer */}
        <Box p={4} borderTopWidth="1px" borderColor="border.subtle" textAlign="center">
          <Box
            as="button"
            w="full"
            py={3}
            borderRadius="xl"
            bg={timeExpired ? 'gray.700' : 'green.600'}
            color="white"
            fontWeight="700"
            fontSize="sm"
            mb={3}
            cursor="pointer"
            _hover={{ opacity: 0.9 }}
            onClick={onClose}
          >
            {timeExpired ? 'Süre doldu' : 'Oyun bitti'}
          </Box>
          <Text
            fontSize="sm"
            color="text.muted"
            cursor="pointer"
            textDecoration="underline"
            onClick={onClose}
          >
            Kapat
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ParollaGame() {
  const today  = todayLocal();
  const { user } = useAuthStore();
  const STORAGE_KEY = storageKey(user?._id ?? 'guest');

  const [results,     setResults]     = useState<LetterResult[]>([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [timeLeft,    setTimeLeft]    = useState(GAME_DURATION);
  const [gameStatus,  setGameStatus]  = useState<'loading' | 'ready' | 'playing' | 'finished'>('loading');
  const [timeExpired, setTimeExpired] = useState(false);
  const [userInput,   setUserInput]   = useState('');
  const [submitted,   setSubmitted]   = useState(false);
  const [showModal,   setShowModal]   = useState(false);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [inputError,  setInputError]  = useState<string | null>(null);

  const inputRef        = useRef<HTMLInputElement>(null);
  const bubblesRef      = useRef<HTMLDivElement>(null);
  const bubbleRefsArr   = useRef<(HTMLDivElement | null)[]>([]);
  const revisitModeRef  = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved: SavedState = JSON.parse(raw);
          if (saved.date === today) {
            setResults(saved.results);
            setCurrentIdx(saved.currentIdx);
            setTimeLeft(saved.timeLeft);
            setSubmitted(saved.submitted);
            setGameStatus(saved.gameStatus);
            if (saved.gameStatus === 'finished') setShowModal(true);
            // Eğer hiç unanswered harf kalmadıysa revisit modundayız
            if (saved.results.every(r => r.status !== 'unanswered')) {
              revisitModeRef.current = true;
            }
            return;
          }
        }
        const questions = await getDailyQuestions(today);
        setResults(questions.map(q => ({
          letter:        q.letter.name,
          question:      q.question,
          correctAnswer: q.answer,
          userAnswer:    '',
          status:        'unanswered',
        })));
        setGameStatus('ready');
      } catch {
        setLoadError('Sorular yüklenemedi. Bağlantınızı kontrol edin.');
      }
    }
    init();
  }, [today]);

  // ── Persist ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameStatus === 'loading' || gameStatus === 'ready' || results.length === 0) return;
    const state: SavedState = { date: today, results, currentIdx, timeLeft, gameStatus, submitted };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [today, results, currentIdx, timeLeft, gameStatus, submitted]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [gameStatus]);

  useEffect(() => {
    if (timeLeft === 0 && gameStatus === 'playing') {
      setGameStatus('finished');
      setTimeExpired(true);
      setShowModal(true);
    }
  }, [timeLeft, gameStatus]);

  // ── Focus input ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameStatus === 'playing') inputRef.current?.focus();
  }, [gameStatus, currentIdx]);

  // ── Aktif harfi container'da ortala ──────────────────────────────────────
  useEffect(() => {
    const container = bubblesRef.current;
    const el = bubbleRefsArr.current[currentIdx];
    if (!container || !el) return;
    const scrollTarget = el.offsetLeft - container.clientWidth / 2 + el.offsetWidth / 2;
    container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
  }, [currentIdx]);

  // ── Auto-submit to backend when finished ──────────────────────────────────
  useEffect(() => {
    if (gameStatus !== 'finished' || submitted) return;
    const correct = results.filter(r => r.status === 'correct').length;
    const wrong   = results.filter(r => r.status === 'wrong').length;
    const blank   = results.filter(r => r.status === 'skipped' || r.status === 'unanswered').length;
    api.post('/entries', { gameSlug: 'parolla', scores: { correct, wrong, blank } })
      .then(() => setSubmitted(true))
      .catch((err: AxiosError<ApiResponse>) => {
        if (err.response?.status === 409) setSubmitted(true);
      });
  }, [gameStatus, submitted, results]);

  // ── Advance to next letter ────────────────────────────────────────────────
  const advance = useCallback((updated: LetterResult[], from: number) => {
    if (!revisitModeRef.current) {
      // Birinci tur: sıradaki unanswered harfe git
      const nextUnanswered = updated.findIndex((r, i) => i > from && r.status === 'unanswered');
      if (nextUnanswered !== -1) {
        setCurrentIdx(nextUnanswered);
        setUserInput('');
        return;
      }
      revisitModeRef.current = true;
    }

    // Pas modu: from'dan sonra döngüsel olarak ilk pas harfi
    const total = updated.length;
    for (let offset = 1; offset <= total; offset++) {
      const idx = (from + offset) % total;
      if (updated[idx].status === 'skipped') {
        setCurrentIdx(idx);
        setUserInput('');
        return;
      }
    }

    // Pas harf kalmadı (hepsi doğru/yanlış cevaplanmış) — bitir
    setGameStatus('finished');
    setTimeExpired(false);
    setShowModal(true);
  }, []);

  // ── Start (ready → playing) ───────────────────────────────────────────────
  const handleStart = useCallback(() => {
    setGameStatus('playing');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // ── Submit answer ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (gameStatus !== 'playing') return;
    const trimmed = userInput.trim();
    if (!trimmed) return;
    const currentLetter = results[currentIdx].letter.toLocaleUpperCase('tr-TR');
    if (trimmed[0].toLocaleUpperCase('tr-TR') !== currentLetter) {
      setInputError(`Cevap "${currentLetter}" harfiyle başlamalı.`);
      setTimeout(() => setInputError(null), 2500);
      return;
    }
    const isCorrect = checkAnswer(trimmed, results[currentIdx].correctAnswer);
    isCorrect ? playCorrectSound() : playWrongSound();
    const updated = [...results];
    updated[currentIdx] = {
      ...updated[currentIdx],
      userAnswer: trimmed,
      status: isCorrect ? 'correct' : 'wrong',
    };
    setResults(updated);
    advance(updated, currentIdx);
  }, [gameStatus, userInput, results, currentIdx, advance]);

  // ── Skip ──────────────────────────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    if (gameStatus !== 'playing') return;
    playSkipSound();
    const updated = [...results];
    updated[currentIdx] = { ...updated[currentIdx], userAnswer: '', status: 'skipped' };
    setResults(updated);
    advance(updated, currentIdx);
  }, [gameStatus, results, currentIdx, advance]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    else if (e.key === 'Tab') { e.preventDefault(); handleSkip(); }
  }, [handleSubmit, handleSkip]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <Alert.Root status="error" borderRadius="xl">
        <Alert.Indicator />
        <Alert.Title>{loadError}</Alert.Title>
      </Alert.Root>
    );
  }

  if (gameStatus === 'loading') {
    return (
      <VStack py={20} gap={4} align="center">
        <Spinner size="lg" />
        <Text color="text.muted" fontSize="sm">Sorular yükleniyor…</Text>
      </VStack>
    );
  }

  const current = results[currentIdx];

  return (
    <Box w="full" position="relative" minH="60vh" display="flex" flexDir="column">

      {gameStatus === 'ready' && <ReadyModal onStart={handleStart} />}

      {showModal && (
        <ResultModal
          results={results}
          timeExpired={timeExpired}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Letter bubbles */}
      <Box ref={bubblesRef} overflowX="auto" w="full" pb={2}
        css={{ '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}
      >
        <HStack gap={{ base: 2, md: 3 }} px={4} minW="max-content">
          {results.map((r, i) => {
            const colored = r.status !== 'unanswered';
            const isCurrent = i === currentIdx && gameStatus === 'playing';
            return (
              <Box
                key={r.letter}
                ref={(el: HTMLDivElement | null) => { bubbleRefsArr.current[i] = el; }}
                w={{ base: '48px', md: '56px' }}
                h={{ base: '48px', md: '56px' }}
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize={{ base: 'sm', md: 'md' }}
                fontWeight="800"
                flexShrink={0}
                bg={colored ? STATUS_BG[r.status] : 'surface.card'}
                color={colored ? 'white' : 'text.muted'}
                border={isCurrent ? '3px solid' : '2px solid'}
                borderColor={isCurrent ? 'white' : 'border.subtle'}
                transition="background 0.2s"
              >
                {r.letter}
              </Box>
            );
          })}
        </HStack>
      </Box>

      {/* Timer */}
      <HStack justify="center" gap={2} mt={5} color={timeLeft <= 30 ? 'red.400' : 'text.muted'}>
        <Text fontSize="lg">⏱</Text>
        <Text fontFamily="mono" fontSize="2xl" fontWeight="700">{fmtTime(timeLeft)}</Text>
      </HStack>

      {/* Question */}
      <Box flex={1} display="flex" alignItems="center" justifyContent="center" px={6} py={8}>
        {gameStatus === 'playing' && current && (
          <Text
            fontSize={{ base: 'xl', md: '2xl' }}
            fontWeight="800"
            textAlign="center"
            letterSpacing="wider"
          >
            {current.question}
          </Text>
        )}
        {gameStatus === 'finished' && !showModal && null}
      </Box>

      {/* Inline answer key — revisit / after modal closed */}
      {gameStatus === 'finished' && !showModal && (
        <InlineAnswerKey
          results={results}
          onShowStats={() => setShowModal(true)}
        />
      )}

      {/* Input + PAS */}
      {gameStatus === 'playing' && (
        <Box px={4} pb={4} w="full" maxW="600px" mx="auto">
          {/* Letter indicator — stays visible above keyboard on mobile */}
          {current && (
            <HStack justify="center" mb={3} gap={3}>
              <Box
                w="44px" h="44px"
                borderRadius="full"
                display="flex" alignItems="center" justifyContent="center"
                fontWeight="900" fontSize="xl"
                bg="surface.card"
                borderWidth="3px" borderColor="white"
                boxShadow="0 2px 12px rgba(0,0,0,0.4)"
                flexShrink={0}
              >
                {current.letter}
              </Box>
            </HStack>
          )}
          {inputError && (
            <Box
              mb={2}
              px={4}
              py={2}
              borderRadius="lg"
              bg="#c0392b22"
              borderWidth="1px"
              borderColor="#c0392b55"
            >
              <Text fontSize="sm" color="#e74c3c" fontWeight="600">{inputError}</Text>
            </Box>
          )}
          <HStack
            gap={0}
            borderRadius="xl"
            overflow="hidden"
            borderWidth="1px"
            borderColor="border.emphasized"
          >
            <Input
              ref={inputRef}
              value={userInput}
              onChange={e => { setUserInput(e.target.value); if (inputError) setInputError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="Cevabı Yaz"
              border="none"
              borderRadius="0"
              _focus={{ boxShadow: 'none' }}
              fontSize="md"
              h="56px"
              px={5}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Box
              as="button"
              onClick={userInput.trim() ? handleSubmit : handleSkip}
              h="56px"
              px={5}
              bg={userInput.trim() ? '#538d4e' : '#c9a227'}
              color="white"
              fontWeight="700"
              fontSize="sm"
              display="flex"
              alignItems="center"
              gap={2}
              flexShrink={0}
              cursor="pointer"
              _hover={{ opacity: 0.9 }}
              _active={{ opacity: 0.7 }}
              transition="background 0.15s"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Text fontSize="lg" lineHeight={1}>›</Text>
              <Text>{userInput.trim() ? 'Gönder' : 'PAS'}</Text>
            </Box>
          </HStack>
        </Box>
      )}
    </Box>
  );
}
