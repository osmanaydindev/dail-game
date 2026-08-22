'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ParollaGame } from '@/components/parolla/ParollaGame';
import { Box, Heading, Text, Spinner, VStack, HStack } from '@chakra-ui/react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from '@/lib/navigation';
import { api } from '@/lib/api';
import { todayLocal } from '@/lib/date';

interface ParollaScores { correct: number; wrong: number; blank: number; }

type LetterStatus = 'unanswered' | 'correct' | 'wrong' | 'skipped';
interface LetterResult {
  letter: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
  status: LetterStatus;
}

function ParollaCompletedCard({ scores, results }: { scores: ParollaScores; results: LetterResult[] }) {
  const today = todayLocal();
  const { correct, wrong, blank } = scores;
  const total = correct + wrong + blank;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = [
    { label: 'Doğru',  value: correct, color: '#538d4e' },
    { label: 'Yanlış', value: wrong,   color: '#c0392b' },
    { label: 'Boş',    value: blank,   color: '#3a3a3c' },
  ];

  const icon = (s: LetterStatus) =>
    s === 'correct' ? '✓' : s === 'wrong' ? '✗' : s === 'skipped' ? '→' : '–';
  const iconColor = (s: LetterStatus) =>
    s === 'correct' ? '#538d4e' : s === 'wrong' ? '#c0392b' : s === 'skipped' ? '#c9a227' : undefined;

  return (
    <VStack gap={4} align="stretch">
      {/* Score ring card */}
      <Box
        bg="surface.card"
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="border.subtle"
        p={8}
        maxW="360px"
        mx="auto"
        textAlign="center"
        boxShadow="0 8px 32px rgba(0,0,0,0.12)"
        w="full"
      >
        {/* Arc / score ring visual */}
        <Box position="relative" w="120px" h="120px" mx="auto" mb={6}>
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--chakra-colors-border-subtle)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke="#538d4e"
              strokeWidth="10"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <Box position="absolute" inset={0} display="flex" flexDir="column" alignItems="center" justifyContent="center">
            <Text fontSize="2xl" fontWeight="900" lineHeight="1">{pct}%</Text>
            <Text fontSize="xs" color="text.muted">doğru</Text>
          </Box>
        </Box>

        <Text fontSize="xs" fontWeight="700" letterSpacing="widest" color="text.muted" mb={4} textTransform="uppercase">
          Parolla — {today}
        </Text>

        {/* Stat bars */}
        <VStack gap={2} mb={5} align="stretch">
          {stats.map(({ label, value, color }) => (
            <HStack key={label} justify="space-between" align="center">
              <HStack gap={2}>
                <Box w="10px" h="10px" borderRadius="full" bg={color} flexShrink={0} />
                <Text fontSize="sm" color="text.muted">{label}</Text>
              </HStack>
              <HStack gap={2} align="center">
                <Box
                  h="6px"
                  borderRadius="full"
                  bg={color}
                  w={total > 0 ? `${Math.round((value / total) * 80)}px` : '0px'}
                  minW={value > 0 ? '6px' : '0'}
                  opacity={0.8}
                />
                <Text fontSize="sm" fontWeight="700" w="20px" textAlign="right">{value}</Text>
              </HStack>
            </HStack>
          ))}
        </VStack>

        <Text fontSize="sm" color="text.muted">
          {pct >= 80 ? 'Harika bir gün! Yarın tekrar görüşürüz.' : pct >= 50 ? 'Fena değil! Yarın daha iyisini yaparsın.' : 'Yarın daha iyi olacak!'}
        </Text>
      </Box>

      {/* Cevap anahtarı — localStorage'dan geliyorsa göster */}
      {results.length > 0 && (
        <Box
          bg="surface.card"
          borderRadius="2xl"
          borderWidth="1px"
          borderColor="border.subtle"
          overflow="hidden"
          maxW="360px"
          mx="auto"
          w="full"
        >
          <Box px={5} py={3} borderBottomWidth="1px" borderColor="border.subtle">
            <Text fontSize="xs" fontWeight="700" letterSpacing="widest" color="text.muted" textTransform="uppercase">
              Cevap Anahtarı
            </Text>
          </Box>
          <VStack gap={0} align="stretch">
            {results.map(r => (
              <Box
                key={r.letter}
                borderBottomWidth="1px"
                borderColor="border.subtle"
                cursor="pointer"
                onClick={() => setExpanded(prev => prev === r.letter ? null : r.letter)}
                _hover={{ bg: 'surface.subtle' }}
                _last={{ borderBottomWidth: 0 }}
                transition="background 0.1s"
              >
                <HStack py={3} px={4} justify="space-between">
                  <HStack gap={3}>
                    <Text w="16px" fontWeight="800" fontSize="sm" color={iconColor(r.status)}>
                      {icon(r.status)}
                    </Text>
                    <VStack gap={0} align="start">
                      <Text fontSize="sm" fontWeight="700">
                        {r.correctAnswer.toLocaleUpperCase('tr-TR')}
                      </Text>
                      <Text
                        fontSize="xs"
                        color="text.muted"
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
                  <Box px={4} pb={3}>
                    <Box bg="surface.subtle" borderRadius="lg" p={3} borderWidth="1px" borderColor="border.subtle">
                      <Text fontSize="xs" color="text.muted" mb={1}>Soru</Text>
                      <Text fontSize="sm" fontWeight="600" mb={3}>{r.question}</Text>
                      <Text fontSize="xs" color="text.muted" mb={1}>Verilen cevap</Text>
                      <Text fontSize="sm" fontWeight="600" color={iconColor(r.status)}>
                        {r.userAnswer ? r.userAnswer.toLocaleUpperCase('tr-TR') : '—'}
                      </Text>
                    </Box>
                  </Box>
                )}
              </Box>
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
}

export default function ParollaPage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const today  = todayLocal();

  const [checking, setChecking] = useState(true);
  const [entry, setEntry] = useState<ParollaScores | null>(null);
  const [localResults, setLocalResults] = useState<LetterResult[]>([]);

  useEffect(() => {
    if (isInitialized && !user) router.replace('/login');
  }, [isInitialized, user, router]);

  useEffect(() => {
    if (!user) return;
    // localStorage'dan detaylı sonuçları oku (prefix tarama — ID format bağımsız)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('parolla-game-state-')) continue;
        const saved = JSON.parse(localStorage.getItem(key)!);
        if (saved.date === today && Array.isArray(saved.results) && saved.results.length > 0) {
          setLocalResults(saved.results);
          break;
        }
      }
    } catch { /* ignore */ }

    api.get('/entries', { params: { gameSlug: 'parolla', from: today, to: today } })
      .then((res) => {
        const entries = res.data?.data ?? [];
        if (entries.length > 0) setEntry(entries[0].scores as ParollaScores);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [user, today]);

  if (!user || checking) {
    return (
      <AppShell>
        <Box display="flex" justifyContent="center" pt={20}>
          <Spinner />
        </Box>
      </AppShell>
    );
  }

  if (entry) {
    return (
      <AppShell>
        <Box maxW="400px" mx="auto" pt={10} px={4} pb={10}>
          <ParollaCompletedCard scores={entry} results={localResults} />
        </Box>
      </AppShell>
    );
  }

  return (
    // noPadding + mobilde başlık gizli: oyun ekranı harf balonları, süre, soru,
    // cevap alanı ve klavyeyi aynı anda gösterecek dikey alana ihtiyaç duyuyor.
    <AppShell noPadding>
      <Box maxW="600px" mx="auto" px={{ base: 0, md: 6 }}>
        <Box textAlign="center" mb={4} display={{ base: 'none', md: 'block' }}>
          <Heading size="xl" fontWeight="800" mb={1}>Parolla</Heading>
          <Text fontSize="sm" color="text.muted">
            26 harf · 5 dakika · günde bir kez
          </Text>
        </Box>
        <ParollaGame />
      </Box>
    </AppShell>
  );
}
