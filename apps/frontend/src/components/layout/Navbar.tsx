'use client';

import { useState, useEffect } from 'react';
import {
  Box, Flex, HStack, VStack, Text, Button, Avatar, IconButton, Drawer, CloseButton,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from '@/lib/navigation';
import { useAuthStore } from '@/store/authStore';
import { useColorMode } from '@/providers/ChakraProvider';

export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { colorMode, toggleColorMode } = useColorMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const NAV_LINKS = [
    { href: '/' as const, label: t('home') },
    { href: '/leaderboard' as const, label: t('leaderboard') },
    { href: '/wordle' as const, label: t('wordle') },
    { href: '/parolla' as const, label: t('parolla') },
    { href: '/history' as const, label: t('history') },
    { href: '/games' as const, label: t('games') },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const switchLocale = (next: 'en' | 'tr') => {
    router.replace(pathname as any, { locale: next });
  };

  const SiteLogo = () => (
    <Text fontSize="xl" fontWeight="800" letterSpacing="-0.5px">
      Aydınlar <Text as="span" color="brand.500">Oynuyor</Text>
    </Text>
  );

  return (
    <>
      <Box
        as="nav"
        position="sticky"
        top={0}
        zIndex={100}
        borderBottomWidth="1px"
        borderColor={scrolled ? 'transparent' : 'border.subtle'}
        backdropFilter="blur(16px)"
        bg="surface.card"
        boxShadow={scrolled ? '0 4px 24px rgba(0,0,0,0.08)' : 'none'}
        transition="box-shadow 0.3s ease, border-color 0.3s ease"
      >
        <Flex maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} h="64px" align="center" justify="space-between">
          {/* Logo */}
          <Link href="/">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              <SiteLogo />
            </motion.div>
          </Link>

          {/* Desktop nav */}
          <HStack gap={1} display={{ base: 'none', md: 'flex' }}>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={pathname === link.href ? 'subtle' : 'ghost'}
                  size="sm"
                  colorPalette={pathname === link.href ? 'brand' : 'gray'}
                  fontWeight={pathname === link.href ? '600' : '400'}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
            {user?.role === 'admin' && (
              <Link href="/admin">
                <Button
                  variant={pathname.startsWith('/admin') ? 'subtle' : 'ghost'}
                  size="sm"
                  colorPalette={pathname.startsWith('/admin') ? 'red' : 'gray'}
                >
                  {t('admin')}
                </Button>
              </Link>
            )}
          </HStack>

          {/* Right side */}
          <HStack gap={2}>
            {/* Language switcher */}
            <HStack gap={0} borderWidth="1px" borderColor="border.subtle" borderRadius="lg" overflow="hidden">
              {(['en', 'tr'] as const).map((l) => (
                <Button
                  key={l}
                  size="xs"
                  variant={locale === l ? 'solid' : 'ghost'}
                  colorPalette={locale === l ? 'brand' : 'gray'}
                  onClick={() => switchLocale(l)}
                  fontWeight="700"
                  borderRadius="0"
                  px={3}
                  minW="36px"
                >
                  {l.toUpperCase()}
                </Button>
              ))}
            </HStack>

            {/* Color mode toggle */}
            <IconButton aria-label="Toggle color mode" variant="ghost" size="sm" onClick={toggleColorMode}>
              {colorMode === 'dark' ? '☀️' : '🌙'}
            </IconButton>

            {/* Profile dropdown (desktop only) */}
            {user ? (
              <Box position="relative" display={{ base: 'none', md: 'block' }}>
                {/* Backdrop */}
                {profileOpen && (
                  <Box
                    position="fixed"
                    inset={0}
                    zIndex={150}
                    onClick={() => setProfileOpen(false)}
                  />
                )}

                <Avatar.Root
                  size="sm"
                  cursor="pointer"
                  onClick={() => setProfileOpen((v) => !v)}
                >
                  <Avatar.Fallback name={user.displayName} />
                  {user.avatarUrl && <Avatar.Image src={user.avatarUrl} alt={user.displayName} />}
                </Avatar.Root>

                {profileOpen && (
                  <Box
                    position="absolute"
                    top="calc(100% + 6px)"
                    right={0}
                    zIndex={200}
                    bg="surface.card"
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    boxShadow="lg"
                    minW="160px"
                    py={1}
                    overflow="hidden"
                  >
                    <Link href="/profile" onClick={() => setProfileOpen(false)}>
                      <Box px={4} py={2.5} fontSize="sm" _hover={{ bg: 'surface.subtle' }} cursor="pointer">
                        {t('profile')}
                      </Box>
                    </Link>
                    <Link href="/entry" onClick={() => setProfileOpen(false)}>
                      <Box px={4} py={2.5} fontSize="sm" _hover={{ bg: 'surface.subtle' }} cursor="pointer">
                        {t('submitScore')}
                      </Box>
                    </Link>
                    <Box h="1px" bg="border.subtle" />
                    <Box
                      px={4} py={2.5}
                      fontSize="sm"
                      color="red.500"
                      _hover={{ bg: 'surface.subtle' }}
                      cursor="pointer"
                      onClick={() => { setProfileOpen(false); handleLogout(); }}
                    >
                      {t('logout')}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Box display={{ base: 'none', md: 'block' }}>
                <Link href="/login">
                  <Button size="sm" colorPalette="brand" variant="solid">{t('login')}</Button>
                </Link>
              </Box>
            )}

            {/* Mobile hamburger */}
            <IconButton
              aria-label="Open menu"
              variant="ghost"
              size="sm"
              display={{ base: 'flex', md: 'none' }}
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </IconButton>
          </HStack>
        </Flex>
      </Box>

      {/* Mobile drawer */}
      <Drawer.Root open={mobileOpen} onOpenChange={(e) => setMobileOpen(e.open)} placement="start">
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content maxW="280px">
            <Drawer.Header borderBottomWidth="1px" borderColor="border.subtle" position="relative">
              <SiteLogo />
              <Drawer.CloseTrigger asChild position="absolute" right={3} top="50%" transform="translateY(-50%)">
                <CloseButton size="sm" />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body pt={4}>
              <VStack align="stretch" gap={1}>
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                    <Button
                      variant={pathname === link.href ? 'subtle' : 'ghost'}
                      colorPalette={pathname === link.href ? 'brand' : 'gray'}
                      fontWeight={pathname === link.href ? '600' : '400'}
                      w="full"
                      justifyContent="flex-start"
                    >
                      {link.label}
                    </Button>
                  </Link>
                ))}
                {user?.role === 'admin' && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)}>
                    <Button
                      variant={pathname.startsWith('/admin') ? 'subtle' : 'ghost'}
                      colorPalette={pathname.startsWith('/admin') ? 'red' : 'gray'}
                      w="full"
                      justifyContent="flex-start"
                    >
                      {t('admin')}
                    </Button>
                  </Link>
                )}

                {user ? (
                  <>
                    <Box h="1px" bg="border.subtle" my={2} />
                    <Link href="/profile" onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" colorPalette="gray" w="full" justifyContent="flex-start">
                        {t('profile')}
                      </Button>
                    </Link>
                    <Link href="/entry" onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" colorPalette="gray" w="full" justifyContent="flex-start">
                        {t('submitScore')}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      colorPalette="red"
                      w="full"
                      justifyContent="flex-start"
                      onClick={() => { setMobileOpen(false); handleLogout(); }}
                    >
                      {t('logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Box h="1px" bg="border.subtle" my={2} />
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <Button colorPalette="brand" variant="solid" w="full">
                        {t('login')}
                      </Button>
                    </Link>
                  </>
                )}
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}
