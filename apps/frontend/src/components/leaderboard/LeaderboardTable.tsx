'use client';

import { useState } from 'react';
import {
  Avatar, HStack, Text, Box,
  Dialog, VStack, Separator, Button,
} from '@chakra-ui/react';
import { useTranslations } from 'next-intl';
import type { LeaderboardEntry, WordleScores, ParollaScores } from '@dail-game/types';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  title: string;
  scoreLabel?: string;
}

function formatRawScore(entry: LeaderboardEntry, dnfLabel: string): string | null {
  if (!entry.rawScores || !entry.gameSlug) return null;
  if (entry.gameSlug === 'wordle') {
    const s = entry.rawScores as WordleScores;
    return s.attempt === 7 ? dnfLabel : `${s.attempt}/6`;
  }
  if (entry.gameSlug === 'parolla') {
    const s = entry.rawScores as ParollaScores;
    // Symbols rather than bare numbers — "24·1·1" gives no clue which is which.
    return `${s.correct}✓ ${s.wrong}✗ ${s.blank}○`;
  }
  return null;
}

/** Shared 0–100 presentation so every surface shows the same number the same way. */
export function formatScore(normalized: number): string {
  return (normalized * 100).toFixed(1);
}

// ─── Player detail modal ───────────────────────────────────────────────────────
function PlayerModal({
  entry,
  open,
  onClose,
  dnfLabel,
  scoreLabel,
}: {
  entry: LeaderboardEntry;
  open: boolean;
  onClose: () => void;
  dnfLabel: string;
  scoreLabel: string;
}) {
  const rawDisplay = formatRawScore(entry, dnfLabel);

  return (
    <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose(); }} placement="center" motionPreset="slide-in-bottom">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content borderRadius="2xl" mx={4} maxW="360px">
          <Dialog.Header pt={6} pb={0} px={6}>
            <HStack gap={4}>
              <Avatar.Root size="xl">
                <Avatar.Fallback name={entry.displayName} />
                {entry.avatarUrl && <Avatar.Image src={entry.avatarUrl} alt={entry.displayName} />}
              </Avatar.Root>
              <Box overflow="hidden">
                <Text fontWeight="700" fontSize="lg" truncate>@{entry.username}</Text>
              </Box>
            </HStack>
          </Dialog.Header>

          <Dialog.Body px={6} py={5}>
            <Separator mb={5} />
            <VStack gap={4} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="sm" color="text.muted">Sıra</Text>
                <Text fontWeight="700" fontSize="lg" color={entry.rank <= 3 ? 'brand.500' : undefined}>
                  #{entry.rank}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="text.muted">{scoreLabel}</Text>
                <Text fontWeight="700" fontFamily="mono">
                  {formatScore(entry.normalizedScore)}
                </Text>
              </HStack>
              {rawDisplay && (
                <HStack justify="space-between">
                  <Text fontSize="sm" color="text.muted">Sonuç</Text>
                  <Text fontFamily="mono" fontSize="sm">{rawDisplay}</Text>
                </HStack>
              )}
            </VStack>
          </Dialog.Body>

          <Dialog.Footer pb={6} px={6}>
            <Button variant="outline" w="full" onClick={onClose}>
              Kapat
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function LeaderboardTable({ entries, title, scoreLabel }: LeaderboardTableProps) {
  const t = useTranslations('leaderboard');
  const tCommon = useTranslations('common');
  const label = scoreLabel ?? tCommon('score');
  const topScore = entries.length > 0 ? entries[0].normalizedScore : null;

  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);

  // The overall board carries no per-game result, so the column is dropped
  // instead of printing a dash on every row.
  const hasRawScores = entries.some((e) => formatRawScore(e, '') !== null);

  return (
    <>
      <Box bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" overflow="hidden" minW={0}>
        <HStack
          justify="space-between"
          align="baseline"
          px={4}
          py={3}
          borderBottomWidth="1px"
          borderColor="border.subtle"
          gap={2}
        >
          <Text fontWeight="700" fontSize="md">{title}</Text>
          {/* Labels the number column without a full header row — that row was
              what forced fixed widths and wrapped "Toplam Skor" onto 3 lines. */}
          <Text
            fontSize="10px"
            fontWeight="700"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color="text.muted"
            flexShrink={0}
            whiteSpace="nowrap"
          >
            {label}
          </Text>
        </HStack>

        <Box>
          {entries.map((entry, i) => {
            const rawDisplay = formatRawScore(entry, t('dnf'));
            const isLeader = topScore !== null && entry.normalizedScore === topScore;

            return (
              <HStack
                key={entry.userId}
                as="button"
                w="full"
                textAlign="left"
                gap={3}
                px={4}
                py={2.5}
                borderTopWidth={i === 0 ? 0 : '1px'}
                borderColor="border.subtle"
                cursor="pointer"
                bg="transparent"
                onClick={() => setSelected(entry)}
                _hover={{ bg: 'surface' }}
                transition="background 0.12s"
              >
                <Text
                  fontFamily="mono"
                  fontSize="sm"
                  fontWeight="700"
                  w="16px"
                  flexShrink={0}
                  color={isLeader ? 'brand.500' : 'text.muted'}
                >
                  {entry.rank}
                </Text>

                <Avatar.Root size="xs" flexShrink={0}>
                  <Avatar.Fallback name={entry.displayName} />
                  {entry.avatarUrl && <Avatar.Image src={entry.avatarUrl} alt={entry.displayName} />}
                </Avatar.Root>

                <Text fontWeight="600" fontSize="sm" flex={1} minW={0} truncate>
                  @{entry.username}
                </Text>

                {hasRawScores && (
                  <Text
                    fontFamily="mono"
                    fontSize="xs"
                    color="text.muted"
                    flexShrink={0}
                    whiteSpace="nowrap"
                  >
                    {rawDisplay ?? '—'}
                  </Text>
                )}

                <Text
                  fontFamily="mono"
                  fontSize="sm"
                  fontWeight="700"
                  minW="44px"
                  textAlign="right"
                  flexShrink={0}
                >
                  {formatScore(entry.normalizedScore)}
                </Text>
              </HStack>
            );
          })}
        </Box>
      </Box>

      {selected && (
        <PlayerModal
          entry={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
          dnfLabel={t('dnf')}
          scoreLabel={label}
        />
      )}
    </>
  );
}
