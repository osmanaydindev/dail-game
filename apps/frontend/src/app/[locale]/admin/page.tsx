'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/authStore';
import { useRouter, Link } from '@/lib/navigation';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Box,
  Grid,
  Heading,
  Text,
  HStack,
  Button,
} from '@chakra-ui/react';
import { LoadingState } from '@/components/ui/LoadingState';

interface Stats {
  totalUsers: number;
  totalEntries: number;
  activeUsers: number;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Box
      bg="surface.card"
      borderRadius="xl"
      borderWidth="1px"
      borderColor="border.subtle"
      p={5}
    >
      <Text color="text.muted" fontSize="sm" fontWeight="500" mb={3}>{label}</Text>
      <Text fontSize="3xl" fontWeight="800" letterSpacing="-1px">{value}</Text>
    </Box>
  );
}

export default function AdminPage() {
  const t = useTranslations('admin');
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'admin')) router.replace('/');
  }, [isInitialized, user, router]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get<{ data: Stats }>('/admin/entries/stats')
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || user.role !== 'admin') return null;

  return (
    <AppShell>
      <HStack justify="space-between" mb={8} wrap="wrap" gap={3}>
        <Heading size="xl" fontWeight="800">{t('dashboard')}</Heading>
        <HStack gap={2}>
          <Link href="/admin/users">
            <Button colorPalette="brand" size="sm" variant="outline">{t('manageUsers')}</Button>
          </Link>
          <Link href="/admin/entries">
            <Button colorPalette="gray" size="sm" variant="outline">{t('manageEntries')}</Button>
          </Link>
        </HStack>
      </HStack>

      {loading && <LoadingState />}
      {!loading && stats && (
        <Grid templateColumns={{ base: '1fr', sm: 'repeat(3, 1fr)' }} gap={5} mb={8}>
          <StatCard label={t('totalUsers')} value={stats.totalUsers} />
          <StatCard label={t('activeUsers')} value={stats.activeUsers} />
          <StatCard label={t('totalEntries')} value={stats.totalEntries} />
        </Grid>
      )}

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={5}>
        {[
          { href: '/admin/users', label: t('manageUsers'), desc: t('manageUsersDesc') },
          { href: '/admin/entries', label: t('manageEntries'), desc: t('manageEntriesDesc') },
        ].map((card, i) => (
          <Link key={card.href} href={card.href}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
            >
              <Box
                bg="surface.card"
                borderRadius="xl"
                borderWidth="1px"
                borderColor="border.subtle"
                p={6}
                cursor="pointer"
              >
                <Text fontWeight="700" fontSize="lg" mb={1}>{card.label}</Text>
                <Text color="text.muted" fontSize="sm">{card.desc}</Text>
              </Box>
            </motion.div>
          </Link>
        ))}
      </Grid>
    </AppShell>
  );
}
