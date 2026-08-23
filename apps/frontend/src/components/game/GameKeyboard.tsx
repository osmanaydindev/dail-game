'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Box, VStack, HStack } from '@chakra-ui/react';

export type KeyStatus = 'correct' | 'present' | 'absent' | 'unused';

// Türkçe Q klavye düzeni — ı (I) 1. satırda U'dan sonra, i (İ) 2. satırda Ş'den sonra.
export const KEYBOARD_LETTER_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç'],
];

const KEY_BG: Record<KeyStatus, string> = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent: '#3a3a3c',
  unused: '',
};

const DELETE_LABEL = '⌫';

interface KeyProps {
  label: string;
  keyStatus?: KeyStatus;
  /** Explicit background — wins over keyStatus. Used by the action key. */
  bg?: string;
  wide?: boolean;
  flex?: number;
  onPress: () => void;
}

function KeyboardKey({ label, keyStatus = 'unused', bg, wide, flex, onPress }: KeyProps) {
  const statusBg = keyStatus !== 'unused' ? KEY_BG[keyStatus] : undefined;
  const background = bg ?? statusBg;

  return (
    <Box
      as="button"
      onClick={onPress}
      display="flex"
      alignItems="center"
      justifyContent="center"
      h={{ base: '50px', md: '64px' }}
      flex={flex}
      minW={wide ? { base: '40px', md: '58px' } : { base: '26px', md: '36px' }}
      px={wide ? { base: 0.5, md: 1 } : 0}
      fontSize={wide ? { base: '9px', md: '11px' } : { base: '13px', md: 'md' }}
      fontWeight="700"
      borderRadius="6px"
      bg={background ?? 'surface.card'}
      color={background ? 'white' : undefined}
      border="1px solid"
      borderColor="border.subtle"
      cursor="pointer"
      userSelect="none"
      _hover={{ opacity: 0.8 }}
      _active={{ opacity: 0.6 }}
      transition="opacity 0.1s"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {label}
    </Box>
  );
}

export interface GameKeyboardProps {
  /** A letter key was pressed (always upper-case Turkish). */
  onKey: (letter: string) => void;
  onDelete: () => void;
  /** The action key — submits the current guess. */
  onAction: () => void;
  actionLabel: string;
  /** Background for the action key. Omit for the neutral default. */
  actionColor?: string;
  /** Per-letter colouring after a guess is scored. */
  keyStatuses?: Record<string, KeyStatus>;
}

export function GameKeyboard({
  onKey,
  onDelete,
  onAction,
  actionLabel,
  actionColor,
  keyStatuses,
}: GameKeyboardProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  // Measure the real bar height instead of hard-coding a spacer — the bar grows
  // with the md breakpoint and the iOS safe-area inset.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    observer.observe(el);
    setBarHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, []);

  const press = useCallback((key: string) => {
    if (key === DELETE_LABEL) onDelete();
    else onKey(key);
  }, [onDelete, onKey]);

  const [row1, row2, row3] = KEYBOARD_LETTER_ROWS;

  const rows = (
    <VStack gap={1.5} w="full" maxW="500px" mx="auto">
      {[row1, row2].map((row, ri) => (
        <HStack key={ri} gap={{ base: 0.5, md: 1 }} justify="center" flexWrap="nowrap">
          {row.map((key) => (
            <KeyboardKey
              key={key}
              label={key}
              keyStatus={keyStatuses?.[key] ?? 'unused'}
              onPress={() => press(key)}
            />
          ))}
        </HStack>
      ))}

      <HStack gap={{ base: 0.5, md: 1 }} justify="center" flexWrap="nowrap">
        <KeyboardKey label={actionLabel} bg={actionColor} wide onPress={onAction} />
        {row3.map((key) => (
          <KeyboardKey
            key={key}
            label={key}
            keyStatus={keyStatuses?.[key] ?? 'unused'}
            onPress={() => press(key)}
          />
        ))}
        <KeyboardKey label={DELETE_LABEL} wide onPress={onDelete} />
      </HStack>
    </VStack>
  );

  return (
    <>
      {/* In-flow spacer matching the fixed bar, so the board is never hidden
          behind it. Measured rather than hard-coded — see above. */}
      <Box h={`${barHeight}px`} flexShrink={0} aria-hidden="true" />
      <Box
        ref={barRef}
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex={1000}
        w="full"
        bg="surface"
        borderTopWidth="1px"
        borderColor="border.subtle"
        pt={2}
        px={2}
        // Bottom padding clears the iOS home indicator on notched devices.
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {rows}
      </Box>
    </>
  );
}
