'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { DailyLeaderboardWidget } from '@/components/leaderboard/DailyLeaderboardWidget';
import { Box, Text, VStack, HStack, Button } from '@chakra-ui/react';
import { Link } from '@/lib/navigation';
import { useMousePosition } from '@/hooks/useMousePosition';
import { Reveal } from '@/components/ui/Reveal';

const TICKER = [
  'Wordle · 6 denemede bilinmeyen kelimeyi bul',
  'Parolla · Türkçe kelime-çağrışım oyunu',
  'Günlük · Haftalık · Aylık sıralama',
  'Her iki oyunda puan girerek öne geç',
  'Kombinasyon skoru: Wordle %50 + Parolla %50',
  'Her gün yeni kelime, yeni şans',
];

export default function HomePage() {
  const t = useTranslations('home');
  const mouse = useMousePosition();
  const [wSize, setWSize] = useState({ w: 1440, h: 900 });

  useEffect(() => {
    setWSize({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => setWSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const mx = (mouse.x / wSize.w) - 0.5;
  const my = (mouse.y / wSize.h) - 0.5;

  return (
    <AppShell>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Box position="relative" mb={14} minH={{ base: '320px', md: '400px' }}>

        {/* Gradient orbs — react to mouse. Hidden on mobile: huge blur() layers are
            very expensive to composite and there is no mouse to react to there. */}
        <Box display={{ base: 'none', md: 'block' }} position="absolute" inset={0} pointerEvents="none" overflow="hidden" borderRadius="3xl" zIndex={0}>
          <Box
            position="absolute" w="640px" h="640px" borderRadius="full"
            style={{
              background: '#3a5fff',
              filter: 'blur(130px)',
              opacity: 0.12,
              top: '-120px', left: '-80px',
              transform: `translate(${mx * 50}px, ${my * 35}px)`,
              transition: 'transform 0.25s ease-out',
            }}
          />
          <Box
            position="absolute" w="520px" h="520px" borderRadius="full"
            style={{
              background: '#8b5cf6',
              filter: 'blur(110px)',
              opacity: 0.09,
              bottom: '-60px', right: '5%',
              transform: `translate(${mx * -38}px, ${my * -25}px)`,
              transition: 'transform 0.3s ease-out',
            }}
          />
          <Box
            position="absolute" w="340px" h="340px" borderRadius="full"
            style={{
              background: '#ec4899',
              filter: 'blur(90px)',
              opacity: 0.07,
              top: '25%', right: '22%',
              transform: `translate(${mx * 28}px, ${my * 22}px)`,
              transition: 'transform 0.35s ease-out',
            }}
          />
          {/* Cursor spotlight */}
          <Box
            position="absolute" inset={0}
            style={{
              background: `radial-gradient(500px circle at ${mouse.x}px ${mouse.y}px, rgba(58,95,255,0.07), transparent 75%)`,
              transition: 'background 0.1s',
            }}
          />
        </Box>

        {/* Hero content */}
        <Box
          position="relative"
          zIndex={1}
          pt={{ base: 10, md: 16 }}
          pb={{ base: 8, md: 12 }}
          px={{ base: 2, md: 6 }}
        >
          <VStack gap={5} align={{ base: 'center', md: 'flex-start' }} textAlign={{ base: 'center', md: 'left' }}>

            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Text
                fontSize={{ base: '4xl', md: '6xl', lg: '7xl' }}
                fontWeight="900"
                letterSpacing="-2px"
                lineHeight="1.05"
              >
                {t('title')}{' '}
                <Text as="span" className="ao-gradient-text">
                  {t('titleHighlight')}
                </Text>
              </Text>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18, ease: 'easeOut' }}
            >
              <Text color="text.muted" fontSize={{ base: 'md', md: 'lg' }} maxW="480px">
                {t('subtitle')}
              </Text>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
            >
              <HStack gap={3} mt={1} flexWrap="wrap" justify={{ base: 'center', md: 'flex-start' }}>
                <Link href="/entry">
                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  >
                    <Button colorPalette="brand" size="lg" fontWeight="700" px={8} className="ao-cta-glow">
                      {t('submitScore')}
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/leaderboard">
                  <motion.div
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  >
                    <Button variant="outline" size="lg" fontWeight="600" px={7}>
                      {t('fullLeaderboard')}
                    </Button>
                  </motion.div>
                </Link>
              </HStack>
            </motion.div>

          </VStack>
        </Box>
      </Box>

      {/* ── Ticker ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <Box
          overflow="hidden"
          mb={12}
          py={3}
          borderTopWidth="1px"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          <motion.div
            animate={{ x: '-50%' }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'flex', gap: '5rem', width: 'max-content', whiteSpace: 'nowrap', willChange: 'transform' }}
          >
            {[...TICKER, ...TICKER].map((item, i) => (
              <Text key={i} fontSize="sm" color="text.muted" fontWeight="500">
                {item}
              </Text>
            ))}
          </motion.div>
        </Box>
      </motion.div>

      {/* ── Daily leaderboard ─────────────────────────────────────────────── */}
      <Reveal delay={0.5} direction="up">
        <DailyLeaderboardWidget />
      </Reveal>

    </AppShell>
  );
}
