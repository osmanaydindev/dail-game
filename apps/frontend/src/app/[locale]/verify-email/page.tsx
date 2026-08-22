'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Field, Input, Spinner, Text, VStack, Alert } from '@chakra-ui/react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/lib/navigation';
import { useAuthStore } from '@/store/authStore';

type Status = 'verifying' | 'success' | 'failed';

function VerifyEmailInner() {
  const t = useTranslations('auth');
  const locale = useLocale() as 'tr' | 'en';
  const router = useRouter();
  const params = useSearchParams();
  const [token] = useState(() => params.get('token'));
  const { verifyEmail, resendVerification } = useAuthStore();

  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'failed');
  const [failMessage, setFailMessage] = useState<string>(token ? '' : t('missingToken'));
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Verification tokens are single-use — React 18 StrictMode double-invokes
  // effects in dev, which would burn the token on the first render.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    // Keep the token out of the Referer header and browser history.
    window.history.replaceState(null, '', window.location.pathname);

    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setTimeout(() => router.replace('/'), 1500);
      })
      .catch(() => {
        setStatus('failed');
        setFailMessage(t('verifyFailed'));
      });
  }, [token, verifyEmail, router, t]);

  const onResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await resendVerification(email, locale);
      setResendSent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <Box minH="100vh" bg="surface" display="flex" alignItems="center" justifyContent="center" p={4}>
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

          {status === 'verifying' && (
            <VStack gap={4} py={4}>
              <Spinner size="lg" />
              <Text color="text.muted" fontSize="sm">{t('verifying')}</Text>
            </VStack>
          )}

          {status === 'success' && (
            <Alert.Root status="success" borderRadius="lg">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('verifiedTitle')}</Alert.Title>
                <Alert.Description>{t('verified')}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}

          {status === 'failed' && (
            <VStack gap={5} align="stretch">
              <Alert.Root status="error" borderRadius="lg">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('verifyFailedTitle')}</Alert.Title>
                  <Alert.Description>{failMessage}</Alert.Description>
                </Alert.Content>
              </Alert.Root>

              {resendSent ? (
                <Alert.Root status="info" borderRadius="lg" size="sm">
                  <Alert.Indicator />
                  <Alert.Title>{t('resendSent')}</Alert.Title>
                </Alert.Root>
              ) : (
                <>
                  <Field.Root>
                    <Field.Label fontWeight="500">{t('email')}</Field.Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field.Root>
                  <Button
                    colorPalette="brand"
                    size="lg"
                    width="full"
                    fontWeight="600"
                    loading={resending}
                    loadingText={t('resending')}
                    disabled={!email}
                    onClick={onResend}
                  >
                    {t('resendVerification')}
                  </Button>
                </>
              )}

              <Link href="/login" style={{ display: 'block' }}>
                <Button variant="ghost" size="sm" width="full" color="text.muted">
                  {t('login')}
                </Button>
              </Link>
            </VStack>
          )}
        </VStack>
      </Box>
    </Box>
  );
}

export default function VerifyEmailPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
