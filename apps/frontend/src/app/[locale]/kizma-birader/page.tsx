'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { KizmaBiraderGame } from '@/components/kizma-birader/KizmaBiraderGame';
import { Box, Spinner } from '@chakra-ui/react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from '@/lib/navigation';

export default function KizmaBiraderPage() {
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !user) router.replace('/login');
  }, [isInitialized, user, router]);

  if (!user) {
    return (
      <AppShell>
        <Box display="flex" justifyContent="center" pt={20}>
          <Spinner />
        </Box>
      </AppShell>
    );
  }

  return (
    // noPadding: board tam genişlik; hideNavOnLandscape: yatay telefonda immersive
    <AppShell noPadding hideNavOnLandscape>
      <KizmaBiraderGame user={{ _id: user._id, displayName: user.displayName }} />
    </AppShell>
  );
}
