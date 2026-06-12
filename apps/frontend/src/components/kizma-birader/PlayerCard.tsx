'use client';

import React from 'react';
import { Avatar, Box, HStack, Text } from '@chakra-ui/react';
import type { KizmaColor } from './types';
import { BOARD_TINT } from './types';
import { DiePips } from './DiePips';
import { CrownIcon } from './CrownIcon';

export interface CardBubble {
  content: string;
  kind: 'emoji' | 'text' | 'voice';
}

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
  // Sohbet balonu / emote — gönderenin kartına bitişik belirir
  bubble?: CardBubble | null;
  bubblePlacement?: 'above' | 'below';
  onBubbleClick?: () => void;
}

export function PlayerCard({
  name, avatarUrl, color, finished, isTurn, canRoll,
  dieFace, rolling, rollingFace, onRollTap, align,
  bubble, bubblePlacement = 'above', onBubbleClick,
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

  const placementStyle = bubblePlacement === 'above'
    ? { bottom: 'calc(100% + 6px)' }
    : { top: 'calc(100% + 6px)' };

  return (
    <Box
      className="kb-player-card"
      position="relative"
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
      {/* Sohbet balonu / emote — kartın üstünde veya altında belirir */}
      {bubble && bubble.kind === 'emoji' && (
        <Box
          key={`${bubble.content}`}
          className="kb-emote"
          position="absolute"
          left="50%"
          zIndex={30}
          pointerEvents="none"
          fontSize="34px"
          lineHeight="1"
          style={{ ...placementStyle, transform: 'translateX(-50%)', textShadow: 'none' }}
        >
          {bubble.content}
        </Box>
      )}
      {bubble && bubble.kind !== 'emoji' && (
        <Box
          className="kb-speech"
          position="absolute"
          left={align === 'left' ? '8px' : 'auto'}
          right={align === 'right' ? '8px' : 'auto'}
          zIndex={30}
          bg="white"
          color="#1a1f27"
          px={2.5} py={1.5}
          borderRadius="lg"
          maxW="180px"
          boxShadow="0 4px 14px rgba(0,0,0,0.3)"
          cursor={onBubbleClick ? 'pointer' : 'default'}
          onClick={onBubbleClick}
          style={{ ...placementStyle, textShadow: 'none' }}
        >
          <Text fontSize="xs" fontWeight="600" lineClamp={2}>{bubble.content}</Text>
          {/* Kuyruk */}
          <Box
            position="absolute"
            left="14px"
            w="0" h="0"
            style={
              bubblePlacement === 'above'
                ? { top: '100%', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '7px solid white' }
                : { bottom: '100%', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '7px solid white' }
            }
          />
        </Box>
      )}
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
