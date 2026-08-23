'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from '@/lib/navigation';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Box,
  Heading,
  Table,
  Badge,
  Text,
  HStack,
  Input,
  Button,
  Dialog,
  Field,
  VStack,
  Alert,
  Select,
  createListCollection,
} from '@chakra-ui/react';
import type { DailyEntryPublic } from '@dail-game/types';

function formatScore(entry: DailyEntryPublic): string {
  const s = entry.scores as any;
  if (entry.gameSlug === 'wordle') return s.attempt === 7 ? 'DNF' : `${s.attempt}/6`;
  if (entry.gameSlug === 'parolla') return `${s.correct}✓ ${s.wrong}✗ ${s.blank}○`;
  return JSON.stringify(s);
}

export default function AdminEntriesPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const [entries, setEntries] = useState<DailyEntryPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [editing, setEditing] = useState<DailyEntryPublic | null>(null);
  const [editFields, setEditFields] = useState<Record<string, number>>({});
  // Failures stay inside the dialog so the admin can retry; the success notice
  // lives on the page, because the dialog is gone by the time it shows.
  const [editError, setEditError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const gameCollection = createListCollection({
    items: [
      { label: t('allGames'), value: '' },
      { label: 'Wordle', value: 'wordle' },
      { label: 'Parolla', value: 'parolla' },
    ],
  });

  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'admin')) router.replace('/');
  }, [isInitialized, user, router]);

  const fetchEntries = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFilter) params.set('date', dateFilter);
    if (gameFilter) params.set('gameSlug', gameFilter);
    api.get<{ data: DailyEntryPublic[] }>(`/admin/entries?${params.toString()}`)
      .then((res) => setEntries(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user?.role === 'admin') fetchEntries(); }, [user, dateFilter, gameFilter]); // eslint-disable-line

  const openEdit = (entry: DailyEntryPublic) => {
    setEditing(entry);
    setEditFields({ ...(entry.scores as Record<string, number>) });
    setEditError(null);
    setActionMsg(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      await api.patch(`/admin/entries/${editing._id}`, { scores: editFields });
      setEditing(null);
      setActionMsg(t('entryUpdated'));
      fetchEntries();
    } catch {
      setEditError(tCommon('error'));
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== 'admin') return null;

  const scoreFields = editing?.gameSlug === 'wordle'
    ? [{ name: 'attempt', label: 'Attempt (1-6, 7=DNF)' }]
    : [
        { name: 'correct', label: 'Correct' },
        { name: 'wrong', label: 'Wrong' },
        { name: 'blank', label: 'Blank' },
      ];

  return (
    <AppShell>
      <Heading size="xl" fontWeight="800" mb={6}>{t('entries')}</Heading>

      {actionMsg && (
        <Alert.Root status="success" borderRadius="lg" mb={4}>
          <Alert.Indicator />
          <Alert.Title>{actionMsg}</Alert.Title>
        </Alert.Root>
      )}

      <HStack mb={5} gap={3} wrap="wrap">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          maxW="180px"
        />
        <Select.Root
          collection={gameCollection}
          value={[gameFilter]}
          onValueChange={(e) => setGameFilter(e.value[0] ?? '')}
          maxW="180px"
        >
          <Select.Trigger>
            <Select.ValueText placeholder={t('allGames')} />
          </Select.Trigger>
          <Select.Content>
            {gameCollection.items.map((item) => (
              <Select.Item key={item.value} item={item}>
                {item.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        {(dateFilter || gameFilter) && (
          <Button size="sm" variant="ghost" onClick={() => { setDateFilter(''); setGameFilter(''); }}>
            {t('clearFilters')}
          </Button>
        )}
      </HStack>

      {loading && <LoadingState />}
      {!loading && entries.length === 0 && <EmptyState title={t('entries')} />}
      {!loading && entries.length > 0 && (
        <Box bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" overflowX="auto">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>{tCommon('date')}</Table.ColumnHeader>
                <Table.ColumnHeader display={{ base: 'none', sm: 'table-cell' }}>{tCommon('player')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('entries')}</Table.ColumnHeader>
                <Table.ColumnHeader display={{ base: 'none', md: 'table-cell' }}>{tCommon('result')}</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="right">{tCommon('score')}</Table.ColumnHeader>
                <Table.ColumnHeader />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {entries.map((entry: any) => (
                <Table.Row key={entry._id}>
                  <Table.Cell fontFamily="mono" fontSize="sm" whiteSpace="nowrap">{entry.date}</Table.Cell>
                  <Table.Cell fontSize="sm" display={{ base: 'none', sm: 'table-cell' }}>{entry.userId?.displayName ?? entry.userId}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={entry.gameSlug === 'wordle' ? 'green' : 'blue'} variant="subtle" size="sm">
                      {entry.gameSlug}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell fontFamily="mono" fontSize="sm" display={{ base: 'none', md: 'table-cell' }}>{formatScore(entry)}</Table.Cell>
                  <Table.Cell textAlign="right" fontFamily="mono" fontSize="sm" fontWeight="600">
                    {(entry.normalizedScore * 100).toFixed(1)}
                  </Table.Cell>
                  <Table.Cell>
                    <Button size="xs" variant="ghost" colorPalette="brand" onClick={() => openEdit(entry)}>
                      {t('edit')}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {/* Edit dialog */}
      <Dialog.Root open={!!editing} onOpenChange={(e) => { if (!e.open) setEditing(null); }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="2xl" maxW="400px">
            <Dialog.Header>
              <Dialog.Title>{t('editEntry')}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {editError && (
                <Alert.Root status="error" borderRadius="lg" mb={4}>
                  <Alert.Indicator />
                  <Alert.Title>{editError}</Alert.Title>
                </Alert.Root>
              )}
              <VStack gap={4}>
                {scoreFields.map((f) => (
                  <Field.Root key={f.name}>
                    <Field.Label fontWeight="600">{f.label}</Field.Label>
                    <Input
                      type="number"
                      value={editFields[f.name] ?? ''}
                      onChange={(e) =>
                        setEditFields((prev) => ({ ...prev, [f.name]: Number(e.target.value) }))
                      }
                    />
                  </Field.Root>
                ))}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="ghost" onClick={() => setEditing(null)}>{t('cancel')}</Button>
              <Button colorPalette="brand" loading={saving} onClick={saveEdit}>{t('save')}</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </AppShell>
  );
}
