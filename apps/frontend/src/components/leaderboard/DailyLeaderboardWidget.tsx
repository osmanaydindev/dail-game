'use client';

import { useState, useEffect } from 'react';
import { Box, Grid, GridItem, HStack, Text, Button } from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import { LeaderboardTable } from './LeaderboardTable';
import { LoadingState } from '../ui/LoadingState';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import { api } from '@/lib/api';
import { todayLocal } from '@/lib/date';
import type { DailyLeaderboard } from '@dail-game/types';

export function DailyLeaderboardWidget() {
  const t = useTranslations('leaderboard');
  const tCommon = useTranslations('common');

  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState<DailyLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async (targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: DailyLeaderboard }>(`/leaderboard/daily?date=${targetDate}`);
      setData(res.data.data);
    } catch {
      setError(tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboard(date); }, [date]); // eslint-disable-line

  const handlePrevDay = () => {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    if (date >= todayLocal()) return;
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 1);
    setDate(d.toISOString().slice(0, 10));
  };

  // No wrapping card: each table already draws one, and nesting the same
  // surface inside itself just muddies the edges.
  return (
    <Box>
      {/* Header */}
      <HStack justify="space-between" mb={4} gap={3} flexWrap="wrap">
        <Text
          fontSize="xs"
          fontWeight="700"
          letterSpacing="0.1em"
          textTransform="uppercase"
          color="text.muted"
        >
          {t('daily')}
        </Text>
        <HStack gap={2} flexShrink={0} flexWrap="wrap">
          <Button variant="outline" size="sm" onClick={handlePrevDay} aria-label={t('prevDay')}>←</Button>
          <Text fontFamily="mono" fontSize="sm" fontWeight="500" color="text.muted" px={1}>{date}</Text>
          <Button variant="outline" size="sm" onClick={handleNextDay} disabled={date >= todayLocal()} aria-label={t('nextDay')}>→</Button>
          {date !== todayLocal() && (
            <Button variant="ghost" size="sm" colorPalette="brand" onClick={() => setDate(todayLocal())}>
              {tCommon('today')}
            </Button>
          )}
        </HStack>
      </HStack>

      {loading && <LoadingState label={tCommon('loading')} />}
      {error && <ErrorState message={error} onRetry={() => fetchLeaderboard(date)} />}

      {!loading && !error && data && (
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }} gap={4} minW={0}>
          <GridItem minW={0}>
            <LeaderboardTable title="Wordle" entries={data.wordle} />
            {data.wordle.length === 0 && <EmptyState title={t('noWordle')} description={t('beFirst')} />}
          </GridItem>
          <GridItem minW={0}>
            <LeaderboardTable title="Parolla" entries={data.parolla} />
            {data.parolla.length === 0 && <EmptyState title={t('noParolla')} description={t('beFirst')} />}
          </GridItem>
          <GridItem minW={0}>
            <LeaderboardTable title={t('overall')} entries={data.total} />
            {data.total.length === 0 && <EmptyState title={t('noCombined')} description={t('submitBoth')} />}
          </GridItem>
        </Grid>
      )}
    </Box>
  );
}
