'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { todayLocal, currentMonthLocal } from '@/lib/date';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/ui/Reveal';
import type { LeaderboardEntry, DailyLeaderboard } from '@dail-game/types';
import {
  Box,
  Heading,
  Tabs,
  Grid,
  GridItem,
  Input,
  HStack,
  Button,
} from '@chakra-ui/react';

type Period = 'daily' | 'weekly' | 'monthly';

export default function LeaderboardPage() {
  const t = useTranslations('leaderboard');
  const tCommon = useTranslations('common');
  const [period, setPeriod] = useState<Period>('daily');
  const [dateParam, setDateParam] = useState(todayLocal());
  const [monthParam, setMonthParam] = useState(currentMonthLocal());

  const [dailyData, setDailyData] = useState<DailyLeaderboard | null>(null);
  const [periodData, setPeriodData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDaily = async (date: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<{ data: DailyLeaderboard }>(`/leaderboard/daily?date=${date}`);
      setDailyData(res.data.data);
    } catch { setError(tCommon('error')); }
    finally { setLoading(false); }
  };

  const fetchPeriod = async (p: 'weekly' | 'monthly') => {
    setLoading(true); setError(null);
    try {
      const url = p === 'weekly'
        ? `/leaderboard/weekly?date=${dateParam}`
        : `/leaderboard/monthly?month=${monthParam}`;
      const res = await api.get<{ data: { entries: LeaderboardEntry[] } }>(url);
      setPeriodData(res.data.data.entries ?? []);
    } catch { setError(tCommon('error')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (period === 'daily') fetchDaily(dateParam);
    else fetchPeriod(period);
  }, [period, dateParam, monthParam]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <Heading size="xl" fontWeight="800" mb={6}>
        {t('title')}
      </Heading>

      <Tabs.Root
        value={period}
        onValueChange={(e) => setPeriod(e.value as Period)}
        variant="line"
        mb={6}
      >
        <Tabs.List>
          <Tabs.Trigger value="daily">{t('daily')}</Tabs.Trigger>
          <Tabs.Trigger value="weekly">{t('weekly')}</Tabs.Trigger>
          <Tabs.Trigger value="monthly">{t('monthly')}</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {/* Filters */}
      {period === 'daily' && (
        <HStack mb={6} gap={2}>
          <Input type="date" value={dateParam} onChange={(e) => setDateParam(e.target.value)} maxW="180px" />
          <Button size="sm" variant="ghost" colorPalette="brand" onClick={() => setDateParam(todayLocal())}>
            {t('today')}
          </Button>
        </HStack>
      )}
      {period === 'monthly' && (
        <HStack mb={6} gap={2}>
          <Input type="month" value={monthParam} onChange={(e) => setMonthParam(e.target.value)} maxW="160px" />
        </HStack>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && period === 'daily' && dailyData && (
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }} gap={4} minW={0}>
          <GridItem minW={0}>
            <LeaderboardTable title="Wordle" entries={dailyData.wordle} />
            {dailyData.wordle.length === 0 && <EmptyState title={t('noWordle')} />}
          </GridItem>
          <GridItem minW={0}>
            <LeaderboardTable title="Parolla" entries={dailyData.parolla} />
            {dailyData.parolla.length === 0 && <EmptyState title={t('noParolla')} />}
          </GridItem>
          <GridItem minW={0}>
            <LeaderboardTable title={t('overall')} entries={dailyData.total} />
            {dailyData.total.length === 0 && <EmptyState title={t('noCombined')} />}
          </GridItem>
        </Grid>
      )}

      {!loading && !error && (period === 'weekly' || period === 'monthly') && (
        <Box>
          <LeaderboardTable
            title={period === 'weekly' ? t('weekly') : `${t('monthly')} — ${monthParam}`}
            entries={periodData}
           
          />
          {periodData.length === 0 && (
            <EmptyState title={t('empty')} description={t('beFirst')} />
          )}
        </Box>
      )}
    </AppShell>
  );
}
