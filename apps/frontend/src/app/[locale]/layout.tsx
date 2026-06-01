import type { Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AppChakraProvider } from '@/providers/ChakraProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { routing } from '@/i18n/routing';

const inter = Inter({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-inter' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppChakraProvider>
            <AuthProvider>{children}</AuthProvider>
          </AppChakraProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
