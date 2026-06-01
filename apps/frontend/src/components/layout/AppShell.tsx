'use client';

import { Box } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from '@/lib/navigation';
import { Navbar } from './Navbar';

export function AppShell({
  children,
  noPadding,
  hideNavOnLandscape,
}: {
  children: React.ReactNode;
  /** Yatay padding'i kaldırır (Tavla gibi tam genişlik isteyen sayfalar için) */
  noPadding?: boolean;
  /** Telefon yatay modda header'ı gizler (Tavla — dikey alan kazanmak için) */
  hideNavOnLandscape?: boolean;
}) {
  const pathname = usePathname();

  return (
    <Box minH="100vh" bg="surface" className={hideNavOnLandscape ? 'ao-immersive-landscape' : undefined}>
      <Navbar />
      <AnimatePresence mode="popLayout">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            maxWidth: '80rem',
            margin: '0 auto',
            padding: noPadding ? '1rem 0 2rem' : '2rem 1.5rem',
          }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </Box>
  );
}
