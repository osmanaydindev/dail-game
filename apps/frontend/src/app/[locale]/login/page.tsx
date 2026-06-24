'use client';

import { Box, Button, Field, Input, Text, VStack, Alert } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, Link } from '@/lib/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '@dail-game/types';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const { login, isLoading } = useAuthStore();
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await login(data.email, data.password);
      router.replace('/');
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse>).response?.data?.error ?? t('invalidCredentials');
      setError('root', { message: msg });
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
                <Alert.Root status="error" borderRadius="lg" size="sm">
                  <Alert.Indicator /><Alert.Title>{errors.root.message}</Alert.Title>
                </Alert.Root>
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

          <Link href="/" style={{ display: 'block' }}>
            <Button variant="ghost" size="sm" width="full" color="text.muted">
              ← {t('backToHome')}
            </Button>
          </Link>
        </VStack>
      </Box>
    </Box>
  );
}
