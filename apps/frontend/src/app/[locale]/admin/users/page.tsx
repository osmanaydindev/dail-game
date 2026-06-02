'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from '@/lib/navigation';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Box,
  Button,
  Heading,
  HStack,
  Table,
  Badge,
  Avatar,
  Text,
  Alert,
  Dialog,
  Field,
  Input,
  VStack,
} from '@chakra-ui/react';
import Link from 'next/link';
import type { UserPublic } from '@dail-game/types';

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [resetting, setResetting] = useState<UserPublic | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'admin')) router.replace('/');
  }, [isInitialized, user, router]);

  const fetchUsers = () => {
    setLoading(true);
    api.get<{ data: UserPublic[] }>('/admin/users')
      .then((res) => setUsers(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user?.role === 'admin') fetchUsers(); }, [user]);

  const handleDeactivate = async (uid: string) => {
    if (!confirm(t('deactivateConfirm'))) return;
    try {
      await api.delete(`/admin/users/${uid}`);
      setActionMsg({ type: 'success', msg: t('deactivated') });
      fetchUsers();
    } catch {
      setActionMsg({ type: 'error', msg: t('deactivateFailed') });
    }
  };

  const openReset = (u: UserPublic) => {
    setResetting(u);
    setNewPassword('');
    setResetError(null);
  };

  const handleResetPassword = async () => {
    if (!resetting) return;
    if (newPassword.length < 8) {
      setResetError(t('passwordTooShort'));
      return;
    }
    setSavingPassword(true);
    setResetError(null);
    try {
      await api.patch(`/admin/users/${(resetting as any)._id}/password`, { newPassword });
      setResetting(null);
      setActionMsg({ type: 'success', msg: t('passwordUpdated') });
    } catch {
      setResetError(t('passwordUpdateFailed'));
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <AppShell>
      <HStack justify="space-between" mb={6} wrap="wrap" gap={3}>
        <Heading size="xl" fontWeight="800">{t('users')}</Heading>
        <Link href="/admin/users/new">
          <Button colorPalette="brand" fontWeight="600">+ {t('createUser')}</Button>
        </Link>
      </HStack>

      {actionMsg && (
        <Alert.Root status={actionMsg.type} borderRadius="lg" mb={4}>
          <Alert.Indicator />
          <Alert.Title>{actionMsg.msg}</Alert.Title>
        </Alert.Root>
      )}

      {loading && <LoadingState />}
      {!loading && users.length === 0 && (
        <EmptyState title={t('users')} icon="👥" />
      )}
      {!loading && users.length > 0 && (
        <Box bg="surface.card" borderRadius="xl" borderWidth="1px" borderColor="border.subtle" overflowX="auto">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>{tCommon('player')}</Table.ColumnHeader>
                <Table.ColumnHeader display={{ base: 'none', md: 'table-cell' }}>{t('users')}</Table.ColumnHeader>
                <Table.ColumnHeader>{t('role')}</Table.ColumnHeader>
                <Table.ColumnHeader display={{ base: 'none', sm: 'table-cell' }}>{tCommon('active')}</Table.ColumnHeader>
                <Table.ColumnHeader display={{ base: 'none', lg: 'table-cell' }}>{tCommon('joined')}</Table.ColumnHeader>
                <Table.ColumnHeader />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {users.map((u: any) => (
                <Table.Row key={u._id}>
                  <Table.Cell>
                    <HStack gap={2}>
                      <Avatar.Root size="xs">
                        <Avatar.Fallback name={u.displayName} />
                        {u.avatarUrl && <Avatar.Image src={u.avatarUrl} alt={u.displayName} />}
                      </Avatar.Root>
                      <Text fontWeight="500" fontSize="sm" truncate maxW={{ base: '100px', sm: 'unset' }}>{u.displayName}</Text>
                    </HStack>
                  </Table.Cell>
                  <Table.Cell fontSize="sm" color="text.muted" display={{ base: 'none', md: 'table-cell' }}>{u.email}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={u.role === 'admin' ? 'red' : 'brand'} variant="subtle" size="sm">
                      {u.role}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell display={{ base: 'none', sm: 'table-cell' }}>
                    <Badge colorPalette={u.isActive ? 'green' : 'gray'} variant="subtle" size="sm">
                      {u.isActive ? tCommon('active') : tCommon('inactive')}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell fontSize="xs" color="text.muted" fontFamily="mono" display={{ base: 'none', lg: 'table-cell' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell>
                    <HStack gap={1} justify="flex-end">
                      <Button
                        size="xs"
                        variant="ghost"
                        colorPalette="brand"
                        onClick={() => openReset(u)}
                      >
                        {t('resetPassword')}
                      </Button>
                      {u.isActive && u._id !== user._id && (
                        <Button
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => handleDeactivate(u._id)}
                        >
                          {t('deactivate')}
                        </Button>
                      )}
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {/* Reset password dialog */}
      <Dialog.Root open={!!resetting} onOpenChange={(e) => { if (!e.open) setResetting(null); }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="2xl" maxW="400px">
            <Dialog.Header>
              <Dialog.Title>{t('resetPasswordFor', { name: resetting?.displayName ?? '' })}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {resetError && (
                <Alert.Root status="error" borderRadius="lg" mb={4}>
                  <Alert.Indicator />
                  <Alert.Title>{resetError}</Alert.Title>
                </Alert.Root>
              )}
              <VStack gap={4} align="stretch">
                <Field.Root>
                  <Field.Label fontWeight="600">{t('newPassword')}</Field.Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('passwordPlaceholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Field.HelperText>{t('passwordHint')}</Field.HelperText>
                </Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="ghost" onClick={() => setResetting(null)}>{t('cancel')}</Button>
              <Button colorPalette="brand" loading={savingPassword} onClick={handleResetPassword}>
                {t('save')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </AppShell>
  );
}
