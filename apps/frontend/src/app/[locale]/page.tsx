'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { DailyLeaderboardWidget } from '@/components/leaderboard/DailyLeaderboardWidget';
import { Box, Text, VStack, HStack, Stack, Button, Grid, SimpleGrid } from '@chakra-ui/react';
import { Link } from '@/lib/navigation';
import { api } from '@/lib/api';
import { todayLocal, formatGameDay, secondsUntilNextGameDay } from '@/lib/date';
import { useAuthStore } from '@/store/authStore';
import { SCORE_WEIGHTS } from '@dail-game/types';

interface TodayEntry {
  gameSlug: 'wordle' | 'parolla';
  scores: Record<string, number>;
  normalizedScore: number;
}

/** Counts down to the Istanbul midnight that starts the next game day. */
function DayCountdown() {
  const t = useTranslations('home');
  // Rendered only after mount: the server has no clock the client agrees with
  // to the second, and a mismatch would trip hydration.
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    setLeft(secondsUntilNextGameDay());
    const id = setInterval(() => setLeft(secondsUntilNextGameDay()), 1000);
    return () => clearInterval(id);
  }, []);

  if (left === null) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;

  return (
    <HStack gap={2} color="text.muted" fontSize="xs">
      <Text letterSpacing="0.08em" textTransform="uppercase">{t('resetsIn')}</Text>
      <Text fontFamily="mono" fontWeight="600" color="fg">
        {pad(h)}:{pad(m)}:{pad(s)}
      </Text>
    </HStack>
  );
}

/** One game's state for today: unplayed, or the score that was recorded. */
function GameStatus({
  name,
  href,
  played,
  value,
  hint,
}: {
  name: string;
  href: '/wordle' | '/parolla';
  played: boolean;
  value: string;
  hint: string;
}) {
  return (
    <Link href={href}>
      <Box
        py={4}
        px={5}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={played ? 'border.subtle' : 'border.emphasized'}
        bg={played ? 'transparent' : 'surface.card'}
        transition="border-color 0.15s, background 0.15s"
        _hover={{ borderColor: 'brand.500' }}
        h="full"
      >
        <HStack justify="space-between" align="baseline" mb={1}>
          <Text fontSize="xs" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color="text.muted">
            {name}
          </Text>
          <Box
            w="6px"
            h="6px"
            borderRadius="full"
            bg={played ? '#538d4e' : 'border.emphasized'}
            flexShrink={0}
          />
        </HStack>
        <Text fontSize="2xl" fontWeight="800" fontFamily="mono" lineHeight="1.2">
          {value}
        </Text>
        <Text fontSize="xs" color="text.muted" mt={0.5}>
          {hint}
        </Text>
      </Box>
    </Link>
  );
}

export default function HomePage() {
  const t = useTranslations('home');
  const locale = useLocale();
  const { user, isInitialized } = useAuthStore();

  const today = todayLocal();
  const [entries, setEntries] = useState<TodayEntry[] | null>(null);

  useEffect(() => {
    if (!user) { setEntries(null); return; }
    api
      .get<{ data: TodayEntry[] }>('/entries', { params: { from: today, to: today } })
      .then(res => setEntries(res.data.data ?? []))
      .catch(() => setEntries([]));
  }, [user, today]);

  const wordle = entries?.find(e => e.gameSlug === 'wordle');
  const parolla = entries?.find(e => e.gameSlug === 'parolla');

  return (
    <AppShell>

      {/* ── Masthead ──────────────────────────────────────────────────────── */}
      <HStack
        justify="space-between"
        align="center"
        gap={4}
        pb={3}
        mb={{ base: 10, md: 14 }}
        borderBottomWidth="1px"
        borderColor="border.subtle"
        flexWrap="wrap"
      >
        <Text
          fontSize="xs"
          fontWeight="600"
          letterSpacing="0.08em"
          textTransform="uppercase"
          color="text.muted"
        >
          {formatGameDay(today, locale)}
        </Text>
        <DayCountdown />
      </HStack>

      {/* ── Headline + how it works ───────────────────────────────────────── */}
      <Grid
        templateColumns={{ base: '1fr', lg: '1.1fr 0.9fr' }}
        gap={{ base: 10, lg: 16 }}
        alignItems="start"
        mb={{ base: 10, md: 16 }}
      >
        <Box>
          <Text
            fontSize={{ base: '3xl', md: '5xl', lg: '6xl' }}
            fontWeight="900"
            letterSpacing="-0.03em"
            lineHeight="1.02"
          >
            {t('headlineOne')}
            <br />
            <Text as="span" color="brand.500">{t('headlineTwo')}</Text>
          </Text>

          <Text color="text.muted" fontSize={{ base: 'md', md: 'lg' }} mt={5} maxW="480px" lineHeight="1.6">
            {t('subtitle')}
          </Text>

          {/* Stacked full-width on phones so the two buttons line up instead of
              wrapping to different widths. */}
          <Stack direction={{ base: 'column', sm: 'row' }} gap={3} mt={8} align="stretch">
            <Link href="/entry" style={{ display: 'block' }}>
              <Button colorPalette="brand" size="lg" fontWeight="700" px={7} w={{ base: 'full', sm: 'auto' }}>
                {t('submitScore')}
              </Button>
            </Link>
            <Link href="/leaderboard" style={{ display: 'block' }}>
              <Button variant="outline" size="lg" fontWeight="600" px={6} w={{ base: 'full', sm: 'auto' }}>
                {t('fullLeaderboard')}
              </Button>
            </Link>
          </Stack>
        </Box>

        {/* Reference, not decoration — the actual rules, and the only place the
            weighting is spelled out for players. */}
        <Box pt={{ base: 0, lg: 3 }}>
          <Text
            fontSize="xs"
            fontWeight="700"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color="text.muted"
            mb={4}
          >
            {t('howTitle')}
          </Text>
          <VStack align="stretch" gap={0}>
            {[
              t('step1'),
              t('step2'),
              t('step3', {
                wordle: SCORE_WEIGHTS.wordle * 100,
                parolla: SCORE_WEIGHTS.parolla * 100,
              }),
              t('step4'),
            ].map((step, i) => (
              <HStack
                key={i}
                align="baseline"
                gap={4}
                py={3}
                borderTopWidth="1px"
                borderColor="border.subtle"
                _last={{ borderBottomWidth: '1px' }}
              >
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  color="text.muted"
                  flexShrink={0}
                  w="16px"
                >
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text fontSize="sm" lineHeight="1.55">{step}</Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      </Grid>

      {/* ── Today's own state — only meaningful once signed in ────────────── */}
      {isInitialized && user && entries && (
        <Box mb={{ base: 10, md: 14 }}>
          <Text
            fontSize="xs"
            fontWeight="700"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color="text.muted"
            mb={3}
          >
            {t('yourDay')}
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 3 }} gap={3}>
            <GameStatus
              name="Wordle"
              href="/wordle"
              played={!!wordle}
              value={!wordle ? '—' : wordle.scores.attempt >= 7 ? t('dnf') : `${wordle.scores.attempt}/6`}
              hint={!wordle ? t('notPlayed') : wordle.scores.attempt >= 7 ? t('failed') : t('solved')}
            />
            <GameStatus
              name="Parolla"
              href="/parolla"
              played={!!parolla}
              value={parolla ? `${parolla.scores.correct}` : '—'}
              hint={parolla ? t('correctCount') : t('notPlayed')}
            />
            <Box
              py={4}
              px={5}
              borderRadius="lg"
              borderWidth="1px"
              borderColor="border.subtle"
              h="full"
            >
              <Text fontSize="xs" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color="text.muted" mb={1}>
                {t('combined')}
              </Text>
              <Text fontSize="2xl" fontWeight="800" fontFamily="mono" lineHeight="1.2">
                {(
                  (wordle?.normalizedScore ?? 0) * SCORE_WEIGHTS.wordle +
                  (parolla?.normalizedScore ?? 0) * SCORE_WEIGHTS.parolla
                ).toFixed(3)}
              </Text>
              <Text fontSize="xs" color="text.muted" mt={0.5}>
                {t('weightedTotal')}
              </Text>
            </Box>
          </SimpleGrid>
        </Box>
      )}

      <DailyLeaderboardWidget />

    </AppShell>
  );
}
