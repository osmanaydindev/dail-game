'use client';

import { HStack, Text, VStack } from '@chakra-ui/react';

export interface PasswordRuleLabels {
  len: string;
  letter: string;
  digit: string;
}

/**
 * Live checklist mirroring the PASSWORD schema on the backend
 * (`validation/user.schemas.ts`). If one side changes, change both — this is a
 * hint, never the gate.
 */
export function PasswordRules({ value, labels }: { value: string; labels: PasswordRuleLabels }) {
  const rules = [
    { key: 'len', ok: value.length >= 8, label: labels.len },
    { key: 'letter', ok: /\p{L}/u.test(value), label: labels.letter },
    { key: 'digit', ok: /\d/.test(value), label: labels.digit },
  ];

  return (
    <VStack gap={1} align="stretch" mt={2}>
      {rules.map((r) => (
        <HStack key={r.key} gap={2} fontSize="xs">
          <Text color={r.ok ? '#538d4e' : 'text.muted'} w="14px" lineHeight={1.4}>
            {r.ok ? '✓' : '•'}
          </Text>
          <Text color={r.ok ? '#538d4e' : 'text.muted'}>{r.label}</Text>
        </HStack>
      ))}
    </VStack>
  );
}
