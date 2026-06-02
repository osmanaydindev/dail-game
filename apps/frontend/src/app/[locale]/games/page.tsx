'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { Reveal } from '@/components/ui/Reveal';
import { Link } from '@/lib/navigation';
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
} from '@chakra-ui/react';

export default function GamesPage() {
  const t = useTranslations('games');

  const GAMES = [
    {
      slug: 'wordle',
      name: 'Wordle',
      icon: '🟩',
      gradient: 'linear-gradient(135deg, #6aaa64 0%, #3a7a45 100%)',
      description: t('wordle.description'),
      href: '/wordle',
      external: false,
      color: 'green',
      badge: t('daily'),
      infoLabel: t('scoring'),
      info: t('wordle.scoring'),
    },
    {
      slug: 'parolla',
      name: 'Parolla',
      icon: '🔤',
      gradient: 'linear-gradient(135deg, #4a90d9 0%, #2a5fb0 100%)',
      description: t('parolla.description'),
      href: '/parolla',
      external: false,
      color: 'blue',
      badge: t('daily'),
      infoLabel: t('scoring'),
      info: t('parolla.scoring'),
    },
    {
      slug: 'tavla',
      name: 'Tavla',
      icon: '🎲',
      gradient: 'linear-gradient(135deg, #c47b3f 0%, #8a4b1e 100%)',
      description: t('tavla.description'),
      href: '/tavla',
      external: false,
      color: 'orange',
      badge: t('multiplayer'),
      infoLabel: t('mode'),
      info: t('tavla.mode'),
    },
  ];

  return (
    <AppShell>
      <Reveal>
        <Heading size="xl" fontWeight="800" mb={2}>{t('title')}</Heading>
        <Text color="text.muted" mb={8}>{t('subtitle')}</Text>
      </Reveal>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={6}>
        {GAMES.map((game, i) => (
          <GridItem key={game.slug}>
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
              viewport={{ once: true, margin: '-40px' }}
              style={{ height: '100%' }}
            >
              <Box
                bg="surface.card"
                borderRadius="2xl"
                borderWidth="1px"
                borderColor="border.subtle"
                h="full"
                display="flex"
                flexDirection="column"
                overflow="hidden"
                boxShadow="sm"
                transition="box-shadow 0.25s"
                _hover={{ boxShadow: 'xl' }}
              >
                {/* Görsel başlık */}
                <Box
                  position="relative"
                  h="110px"
                  style={{ background: game.gradient }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  overflow="hidden"
                >
                  <Box
                    position="absolute"
                    inset="0"
                    opacity={0.18}
                    bgImage="radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)"
                    bgSize="16px 16px"
                  />
                  <motion.div
                    initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                    whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: i * 0.12 + 0.15, ease: 'backOut' }}
                    viewport={{ once: true }}
                  >
                    <Text fontSize="54px" lineHeight="1" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.25))">
                      {game.icon}
                    </Text>
                  </motion.div>
                </Box>

                <VStack align="stretch" gap={4} p={6} flex={1}>
                  <HStack justify="space-between" align="center">
                    <Text fontWeight="800" fontSize="xl">{game.name}</Text>
                    <Badge colorPalette={game.color} size="sm" variant="subtle">{game.badge}</Badge>
                  </HStack>

                  <Text color="text.muted" fontSize="sm" flex={1}>{game.description}</Text>

                  <Box
                    bg="surface.subtle"
                    borderRadius="lg"
                    px={4}
                    py={3}
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Text fontSize="xs" color="text.muted" fontWeight="500" mb={1}>{game.infoLabel}</Text>
                    <Text fontSize="sm">{game.info}</Text>
                  </Box>

                  {game.external ? (
                    <a href={game.href} target="_blank" rel="noopener noreferrer" style={{ width: '100%' }}>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                        <Button colorPalette={game.color} variant="outline" w="full" fontWeight="600">
                          {t('playNow')}
                        </Button>
                      </motion.div>
                    </a>
                  ) : (
                    <Link href={game.href} style={{ width: '100%' }}>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                        <Button colorPalette={game.color} variant="solid" w="full" fontWeight="600">
                          {t('playNow')}
                        </Button>
                      </motion.div>
                    </Link>
                  )}
                </VStack>
              </Box>
            </motion.div>
          </GridItem>
        ))}
      </Grid>
    </AppShell>
  );
}
