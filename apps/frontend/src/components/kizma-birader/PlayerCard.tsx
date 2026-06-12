'use client';

import React from 'react';
import { Avatar, Box, HStack, Text } from '@chakra-ui/react';
import type { KizmaColor } from './types';
import { BOARD_TINT } from './types';
import { DiePips } from './DiePips';
import { CrownIcon } from './CrownIcon';

interface PlayerCardProps {
  name: string;
  avatarUrl?: string;
  color: KizmaColor;
  finished: number;
  isTurn: boolean;
  canRoll: boolean;
  dieFace: number | null;
  rolling: boolean;
  rollingFace: number;
  onRollTap?: () => void;
  align: 'left' | 'right';
}

export function PlayerCard({
  name, avatarUrl, color, finished, isTurn, canRoll,
  dieFace, rolling, rollingFace, onRollTap, align,
}: PlayerCardProps) {
  const tint = BOARD_TINT[color];

  const slotContent = rolling
    ? <DiePips value={rollingFace} spinning />
    : dieFace != null
      ? <DiePips value={dieFace} />
      : isTurn
        ? <CrownIcon />
        : null;

  const slotStyles = {
    w: '44px',
    h: '44px',
    flexShrink: 0,
    borderRadius: 'lg',
    bg: 'rgba(0,0,0,0.3)',
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: '4px',
  } as const;

  return (
    <Box
      className="kb-player-card"
      borderRadius="xl"
      px={3}
      py={2}
      color="white"
      opacity={isTurn ? 1 : 0.65}
      transition="opacity 0.2s"
      style={{
        background: `linear-gradient(160deg, ${tint} 0%, color-mix(in srgb, ${tint} 60%, black) 100%)`,
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      <HStack justify="space-between" mb={1.5} flexDirection={align === 'right' ? 'row-reverse' : 'row'}>
        <Text fontSize="xs" fontWeight="800" truncate maxW="80%">{name}</Text>
        <Text fontSize="2xs" fontWeight="700" bg="rgba(0,0,0,0.3)" borderRadius="md" px={1.5} py={0.5}>
          {finished}/4
        </Text>
      </HStack>
      <HStack gap={2.5} flexDirection={align === 'right' ? 'row-reverse' : 'row'} justify="flex-start">
        <Avatar.Root
          size="md"
          flexShrink={0}
          borderWidth="2.5px"
          borderColor={isTurn ? '#f0c75e' : 'rgba(255,255,255,0.5)'}
        >
          <Avatar.Fallback name={name} />
          {avatarUrl && <Avatar.Image src={avatarUrl} alt={name} />}
        </Avatar.Root>
        {canRoll ? (
          <Box
            as="button"
            aria-label="Zar at"
            onClick={onRollTap}
            cursor="pointer"
            className="kb-slot-glow"
            outline="2px solid rgba(246,199,94,0.8)"
            {...slotStyles}
          >
            {slotContent}
          </Box>
        ) : (
          <Box {...slotStyles}>{slotContent}</Box>
        )}
      </HStack>
    </Box>
  );
}
