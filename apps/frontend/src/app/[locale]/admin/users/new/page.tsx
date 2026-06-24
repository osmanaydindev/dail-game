'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/authStore';
import { useRouter, Link } from '@/lib/navigation';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';
import {
  Box,
  Button,
  Field,
  Heading,
  Input,
  Select,
  Text,
  VStack,
  Alert,
  createListCollection,
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AxiosError } from 'axios';
import type { ApiResponse } from '@dail-game/types';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z
    .string()
    .min(3, 'En az 3 karakter')
    .max(20, 'En fazla 20 karakter')
    .regex(/^[a-zA-Z0-9_]+$/, 'Sadece harf, rakam ve _'),
  displayName: z.string().min(1).max(50).trim(),
  role: z.enum(['user', 'admin']),
});
type FormValues = z.infer<typeof schema>;

export default function CreateUserPage() {
  const t = useTranslations('admin');
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();

  const roleCollection = createListCollection({
    items: [
      { label: 'User', value: 'user' },
      { label: 'Admin', value: 'admin' },
    ],
  });

  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'admin')) router.replace('/');
  }, [isInitialized, user, router]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    setError,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'user' },
  });

  if (!user || user.role !== 'admin') return null;

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post('/admin/users', data);
      reset();
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse>).response?.data?.error ?? 'Failed to create user';
      setError('root', { message: msg });
    }
  };

  return (
    <AppShell>
      <Box maxW="480px">
        <Link href="/admin/users">
          <Text color="text.muted" fontSize="sm" mb={4} display="inline-flex" alignItems="center" gap={1}>
            {t('backToUsers')}
          </Text>
        </Link>
        <Heading size="xl" fontWeight="800" mb={6}>
          {t('createUserTitle')}
        </Heading>

        <Box bg="surface.card" borderRadius="2xl" borderWidth="1px" borderColor="border.subtle" p={6}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack gap={5} align="stretch">
              {errors.root && (
                <Alert.Root status="error" borderRadius="lg">
                  <Alert.Indicator />
                  <Alert.Title>{errors.root.message}</Alert.Title>
                </Alert.Root>
              )}
              {isSubmitSuccessful && !errors.root && (
                <Alert.Root status="success" borderRadius="lg">
                  <Alert.Indicator />
                  <Alert.Title>{t('userCreated')}</Alert.Title>
                </Alert.Root>
              )}

              <Field.Root invalid={!!errors.username}>
                <Field.Label fontWeight="600">Kullanıcı Adı</Field.Label>
                <Input placeholder="kullanici_adi" {...register('username')} />
                <Field.HelperText>3–20 karakter, harf/rakam/_</Field.HelperText>
                {errors.username && <Field.ErrorText>{errors.username.message}</Field.ErrorText>}
              </Field.Root>

              <Field.Root invalid={!!errors.displayName}>
                <Field.Label fontWeight="600">Görünen Ad</Field.Label>
                <Input placeholder="Jane Doe" {...register('displayName')} />
                {errors.displayName && <Field.ErrorText>{errors.displayName.message}</Field.ErrorText>}
              </Field.Root>

              <Field.Root invalid={!!errors.email}>
                <Field.Label fontWeight="600">Email</Field.Label>
                <Input type="email" placeholder="jane@example.com" {...register('email')} />
                {errors.email && <Field.ErrorText>{errors.email.message}</Field.ErrorText>}
              </Field.Root>

              <Field.Root invalid={!!errors.password}>
                <Field.Label fontWeight="600">Password</Field.Label>
                <Input type="password" placeholder="Min 8 characters" {...register('password')} />
                {errors.password && <Field.ErrorText>{errors.password.message}</Field.ErrorText>}
              </Field.Root>

              <Field.Root invalid={!!errors.role}>
                <Field.Label fontWeight="600">{t('role')}</Field.Label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select.Root
                      collection={roleCollection}
                      value={[field.value]}
                      onValueChange={(e) => field.onChange(e.value[0])}
                    >
                      <Select.Trigger>
                        <Select.ValueText />
                      </Select.Trigger>
                      <Select.Content>
                        {roleCollection.items.map((item) => (
                          <Select.Item key={item.value} item={item}>
                            {item.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  )}
                />
                {errors.role && <Field.ErrorText>{errors.role.message}</Field.ErrorText>}
              </Field.Root>

              <Button
                type="submit"
                colorPalette="brand"
                loading={isSubmitting}
                loadingText={t('creating')}
                fontWeight="600"
              >
                {t('createUser')}
              </Button>
            </VStack>
          </form>
        </Box>
      </Box>
    </AppShell>
  );
}
