'use client';

import { useState } from 'react';
import { Box, Button, Field, Input, Text, VStack, HStack, Alert } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, Link } from '@/lib/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';
import type { AxiosError } from 'axios';
import { EMAIL_NOT_VERIFIED, type ApiResponse } from '@dail-game/types';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale() as 'tr' | 'en';
  const { login, resendVerification, isLoading } = useAuthStore();
  const router = useRouter();

  // Set when the server rejects login because the address is unverified — turns
  // the error into an actionable "resend the link" prompt.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    setUnverifiedEmail(null);
    setResendSent(false);
    try {
      await login(data.email, data.password);
      router.replace('/');
    } catch (err) {
      const serverError = (err as AxiosError<ApiResponse>).response?.data?.error;
      if (serverError === EMAIL_NOT_VERIFIED) {
        setUnverifiedEmail(data.email);
        setError('root', { message: t('emailNotVerified') });
        return;
      }
      setError('root', { message: serverError ?? t('invalidCredentials') });
    }
  };

  const onResend = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    try {
      await resendVerification(unverifiedEmail, locale);
      setResendSent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <Box minH="100vh" bg="surface" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box w="full" maxW="400px" bg="surface.card" borderRadius="2xl" borderWidth="1px" borderColor="border.subtle" p={8} boxShadow="lg">
        <VStack gap={8} align="stretch">
          <VStack gap={2} align="center">
            <Text fontSize="3xl" fontWeight="800" letterSpacing="-1px">
              Aydınlar <Text as="span" color="brand.500">Oynuyor</Text>
            </Text>
            <Text color="text.muted" fontSize="sm">{t('subtitle')}</Text>
          </VStack>

          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack gap={5} align="stretch">
              {errors.root && (
                <Alert.Root status={unverifiedEmail ? 'warning' : 'error'} borderRadius="lg" size="sm">
                  <Alert.Indicator /><Alert.Title>{errors.root.message}</Alert.Title>
                </Alert.Root>
              )}
              {unverifiedEmail && (
                resendSent ? (
                  <Alert.Root status="info" borderRadius="lg" size="sm">
                    <Alert.Indicator /><Alert.Title>{t('resendSent')}</Alert.Title>
                  </Alert.Root>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    width="full"
                    loading={resending}
                    loadingText={t('resending')}
                    onClick={onResend}
                  >
                    {t('resendVerification')}
                  </Button>
                )
              )}
              <Field.Root invalid={!!errors.email}>
                <Field.Label fontWeight="500">{t('email')}</Field.Label>
                <Input type="email" placeholder="you@example.com" autoComplete="email" {...register('email')} />
                {errors.email && <Field.ErrorText>{errors.email.message}</Field.ErrorText>}
              </Field.Root>
              <Field.Root invalid={!!errors.password}>
                <Field.Label fontWeight="500">{t('password')}</Field.Label>
                <Input type="password" placeholder="••••••••" autoComplete="current-password" {...register('password')} />
                {errors.password && <Field.ErrorText>{errors.password.message}</Field.ErrorText>}
              </Field.Root>
              <Button type="submit" colorPalette="brand" size="lg" width="full" loading={isLoading} loadingText={t('signingIn')} fontWeight="600" mt={2}>
                {t('loginButton')}
              </Button>
            </VStack>
          </form>

          <VStack gap={4}>
            <HStack justify="center" gap={2} fontSize="sm">
              <Text color="text.muted">{t('noAccount')}</Text>
              <Link href="/register">
                <Text color="brand.500" fontWeight="600">{t('register')}</Text>
              </Link>
            </HStack>

            <Link href="/" style={{ display: 'block', width: '100%' }}>
              <Button variant="ghost" size="sm" width="full" color="text.muted">
                ← {t('backToHome')}
              </Button>
            </Link>
          </VStack>
        </VStack>
      </Box>
    </Box>
  );
}
