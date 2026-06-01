import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Aydınlar Oynuyor', template: '%s | Aydınlar Oynuyor' },
  description: 'Günlük Wordle ve Parolla liderlik tabloları',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    shortcut: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
  // iOS: launch chrome-less (no URL bar) when added to the home screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aydınlar Oynuyor',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
