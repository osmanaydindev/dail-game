'use client';

import { useState } from 'react';
import { Box, Button, Field, Input, Text, VStack, HStack, Alert } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from '@/lib/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PasswordRules } from '@/components/ui/PasswordRules';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '@dail-game/types';

// Field limits, kept in sync with the backend schemas so the browser rejects
// oversized input before it is ever sent. The server remains the real gate.
const MAX = { email: 254, username: 20, displayName: 50, password: 128 } as const;

// Mirrors registerSchema on the backend (validation/auth.schemas.ts).
const schema = z
  .object({
    email: z.string().trim().max(MAX.email).email(),
    username: z
      .string()
      .min(3)
      .max(MAX.username)
      .regex(/^[a-zA-Z0-9_]+$/),
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(MAX.displayName)
      .regex(/^[^\p{C}]+$/u),
    password: z
      .string()
      .min(8)
      .max(MAX.password)
      .regex(/\p{L}/u)
      .regex(/\d/),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordsDontMatch',
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale() as 'tr' | 'en';
  const { register: registerAccount, isLoading } = useAuthStore();
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      await registerAccount({
        email: data.email,
        username: data.username,
        displayName: data.displayName,
        password: data.password,
        locale,
      });
      setSentTo(data.email);
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse>).response?.data?.error ?? t('registerFailed');
      setError('root', { message: msg });
    }
  };

  return (
    <Box minH="100dvh" bg="surface" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box
        w="full"
        maxW="440px"
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
            <Text color="text.muted" fontSize="sm">
              {sentTo ? t('checkYourEmailTitle') : t('registerSubtitle')}
            </Text>
          </VStack>

          {sentTo ? (
            <VStack gap={5} align="stretch">
              <Alert.Root status="success" borderRadius="lg">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('checkYourEmailTitle')}</Alert.Title>
                  <Alert.Description>{t('checkYourEmail', { email: sentTo })}</Alert.Description>
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
                  {errors.root && (
                    <Alert.Root status="error" borderRadius="lg" size="sm">
                      <Alert.Indicator />
                      <Alert.Title>{errors.root.message}</Alert.Title>
                    </Alert.Root>
                  )}

                  <Field.Root invalid={!!errors.email}>
                    <Field.Label fontWeight="500">{t('email')}</Field.Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoCapitalize="off"
                      spellCheck={false}
                      maxLength={MAX.email}
                      {...register('email')}
                    />
                    {errors.email && <Field.ErrorText>{t('invalidEmail')}</Field.ErrorText>}
                  </Field.Root>

                  <Field.Root invalid={!!errors.username}>
                    <Field.Label fontWeight="500">{t('username')}</Field.Label>
                    <Input
                      placeholder="oyuncu_1"
                      autoComplete="username"
                      autoCapitalize="off"
                      spellCheck={false}
                      maxLength={MAX.username}
                      {...register('username')}
                    />
                    <Field.HelperText>{t('usernameHint')}</Field.HelperText>
                    {errors.username && <Field.ErrorText>{t('usernameHint')}</Field.ErrorText>}
                  </Field.Root>

                  <Field.Root invalid={!!errors.displayName}>
                    <Field.Label fontWeight="500">{t('displayName')}</Field.Label>
                    <Input
                      placeholder="Osman"
                      autoComplete="name"
                      maxLength={MAX.displayName}
                      {...register('displayName')}
                    />
                    {errors.displayName && <Field.ErrorText>{t('displayNameInvalid')}</Field.ErrorText>}
                  </Field.Root>

                  <Field.Root invalid={!!errors.password}>
                    <Field.Label fontWeight="500">{t('password')}</Field.Label>
                    <PasswordInput
                      placeholder="••••••••"
                      autoComplete="new-password"
                      maxLength={MAX.password}
                      toggleLabel={t('togglePassword')}
                      {...register('password')}
                    />
                    <PasswordRules
                      value={passwordValue}
                      labels={{
                        len: t('ruleLength'),
                        letter: t('ruleLetter'),
                        digit: t('ruleDigit'),
                      }}
                    />
                  </Field.Root>

                  <Field.Root invalid={!!errors.confirmPassword}>
                    <Field.Label fontWeight="500">{t('confirmPassword')}</Field.Label>
                    <PasswordInput
                      placeholder="••••••••"
                      autoComplete="new-password"
                      maxLength={MAX.password}
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
                    // isSubmitting also covers the gap before the store flips
                    // isLoading, so a double tap can't fire two registrations.
                    loading={isLoading || isSubmitting}
                    loadingText={t('registering')}
                    fontWeight="600"
                    mt={2}
                  >
                    {t('registerButton')}
                  </Button>
                </VStack>
              </form>

              <HStack justify="center" gap={2} fontSize="sm">
                <Text color="text.muted">{t('alreadyHaveAccount')}</Text>
                <Link href="/login">
                  <Text color="brand.500" fontWeight="600">{t('login')}</Text>
                </Link>
              </HStack>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
