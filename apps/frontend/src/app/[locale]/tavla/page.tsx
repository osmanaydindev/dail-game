'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TavlaGame } from '@/components/tavla/TavlaGame';
import { Box, Spinner } from '@chakra-ui/react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from '@/lib/navigation';

export default function TavlaPage() {
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
    // noPadding: tahta tam genişlikte olsun; TavlaGame kendi padding'ini yönetir
    // hideNavOnLandscape: yatay telefonda header gizlensin, tahtaya dikey alan kalsın
    <AppShell noPadding hideNavOnLandscape>
      <TavlaGame user={{ _id: user._id, displayName: user.displayName }} />
    </AppShell>
  );
}
