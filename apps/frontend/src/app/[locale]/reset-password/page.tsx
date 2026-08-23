'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Field, Text, VStack, Alert } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from '@/lib/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PasswordRules } from '@/components/ui/PasswordRules';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '@dail-game/types';

const MAX_PASSWORD = 128;

const schema = z
  .object({
    password: z
      .string()
      .min(8)
      .max(MAX_PASSWORD)
      .regex(/\p{L}/u)
      .regex(/\d/),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordsDontMatch',
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordInner() {
  const t = useTranslations('auth');
  const params = useSearchParams();
  const { resetPassword } = useAuthStore();

  // Captured once on mount, then stripped from the address bar below.
  const [token] = useState(() => params.get('token') ?? '');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    // A reset token in the URL leaks through the Referer header to anything the
    // page loads, and lingers in browser history. Drop it once we have it.
    window.history.replaceState(null, '', window.location.pathname);
  }, [token]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const passwordValue = watch('password') ?? '';

  const onSubmit = async (data: FormValues) => {
    try {
      await resetPassword(token, data.password);
      setDone(true);
    } catch (err) {
      const serverError = (err as AxiosError<ApiResponse>).response?.data?.error;
      setError('root', {
        message: serverError === 'SAME_PASSWORD' ? t('samePassword') : t('resetFailed'),
      });
    }
  };

  const shell = (children: React.ReactNode) => (
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
          </VStack>
          {children}
        </VStack>
      </Box>
    </Box>
  );

  if (!token) {
    return shell(
      <VStack gap={5} align="stretch">
        <Alert.Root status="error" borderRadius="lg">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('resetFailedTitle')}</Alert.Title>
            <Alert.Description>{t('missingToken')}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
        <Link href="/forgot-password" style={{ display: 'block' }}>
          <Button colorPalette="brand" size="lg" width="full" fontWeight="600">
            {t('requestNewLink')}
          </Button>
        </Link>
      </VStack>,
    );
  }

  if (done) {
    return shell(
      <VStack gap={5} align="stretch">
        <Alert.Root status="success" borderRadius="lg">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('resetDoneTitle')}</Alert.Title>
            <Alert.Description>{t('resetDone')}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
        <Link href="/login" style={{ display: 'block' }}>
          <Button colorPalette="brand" size="lg" width="full" fontWeight="600">
            {t('login')}
          </Button>
        </Link>
      </VStack>,
    );
  }

  return shell(
    <>
      <Text color="text.muted" fontSize="sm" textAlign="center" mt={-4}>
        {t('resetSubtitle')}
      </Text>

      <form onSubmit={handleSubmit(onSubmit)}>
        <VStack gap={5} align="stretch">
          {errors.root && (
            <Alert.Root status="error" borderRadius="lg" size="sm">
              <Alert.Indicator />
              <Alert.Title>{errors.root.message}</Alert.Title>
            </Alert.Root>
          )}

          <Field.Root invalid={!!errors.password}>
            <Field.Label fontWeight="500">{t('newPassword')}</Field.Label>
            <PasswordInput
              placeholder="••••••••"
              autoComplete="new-password"
              maxLength={MAX_PASSWORD}
              toggleLabel={t('togglePassword')}
              {...register('password')}
            />
            <PasswordRules
              value={passwordValue}
              labels={{ len: t('ruleLength'), letter: t('ruleLetter'), digit: t('ruleDigit') }}
            />
          </Field.Root>

          <Field.Root invalid={!!errors.confirmPassword}>
            <Field.Label fontWeight="500">{t('confirmPassword')}</Field.Label>
            <PasswordInput
              placeholder="••••••••"
              autoComplete="new-password"
              maxLength={MAX_PASSWORD}
              toggleLabel={t('togglePassword')}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <Field.ErrorText>{t('passwordsDontMatch')}</Field.ErrorText>}
          </Field.Root>

          <Button
            type="submit"
            colorPalette="brand"
            size="lg"
            width="full"
            loading={isSubmitting}
            loadingText={t('resetting')}
            fontWeight="600"
          >
            {t('resetButton')}
          </Button>
        </VStack>
      </form>

      <Link href="/forgot-password" style={{ display: 'block' }}>
        <Button variant="ghost" size="sm" width="full" color="text.muted">
          {t('requestNewLink')}
        </Button>
      </Link>
    </>,
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
