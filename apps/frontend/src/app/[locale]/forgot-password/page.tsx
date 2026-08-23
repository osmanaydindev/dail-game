'use client';

import { useState } from 'react';
import { Box, Button, Field, Input, Text, VStack, Alert } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from '@/lib/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';

const MAX_EMAIL = 254;

const schema = z.object({
  email: z.string().trim().max(MAX_EMAIL).email(),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const locale = useLocale() as 'tr' | 'en';
  const { forgotPassword } = useAuthStore();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    // The endpoint answers identically whether or not the account exists, so
    // there is nothing to branch on here — any error is a transport failure.
    try {
      await forgotPassword(data.email, locale);
    } finally {
      setSent(true);
    }
  };

  return (
    <Box minH="100dvh" bg="surface" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box
        w="full"
        maxW="420px"
        bg="surface.card"
        borderRadius="2xl"
        borderWidth="1px"
        borderColor="border.subtle"
        p={8}
        boxShadow="lg"
      >
        <VStack gap={8} align="stretch">
          <VStack gap={2} align="center">
            <Text fontSize="3xl" fontWeight="800" letterSpacing="-1px">
              Aydınlar <Text as="span" color="brand.500">Oynuyor</Text>
            </Text>
            <Text color="text.muted" fontSize="sm" textAlign="center">
              {sent ? t('forgotSentTitle') : t('forgotSubtitle')}
            </Text>
          </VStack>

          {sent ? (
            <VStack gap={5} align="stretch">
              <Alert.Root status="success" borderRadius="lg">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('forgotSentTitle')}</Alert.Title>
                  <Alert.Description>{t('forgotSent')}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
              <Text fontSize="sm" color="text.muted" textAlign="center">
                {t('checkSpam')}
              </Text>
              <Link href="/login" style={{ display: 'block' }}>
                <Button variant="outline" size="lg" width="full" fontWeight="600">
                  {t('login')}
                </Button>
              </Link>
            </VStack>
          ) : (
            <>
              <form onSubmit={handleSubmit(onSubmit)}>
                <VStack gap={5} align="stretch">
                  <Field.Root invalid={!!errors.email}>
                    <Field.Label fontWeight="500">{t('email')}</Field.Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoCapitalize="off"
                      spellCheck={false}
                      maxLength={MAX_EMAIL}
                      {...register('email')}
                    />
                    {errors.email && <Field.ErrorText>{t('invalidEmail')}</Field.ErrorText>}
                  </Field.Root>

                  <Button
                    type="submit"
                    colorPalette="brand"
                    size="lg"
                    width="full"
                    loading={isSubmitting}
                    loadingText={t('forgotSending')}
                    fontWeight="600"
                  >
                    {t('forgotButton')}
                  </Button>
                </VStack>
              </form>

              <Link href="/login" style={{ display: 'block' }}>
                <Button variant="ghost" size="sm" width="full" color="text.muted">
                  ← {t('login')}
                </Button>
              </Link>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
