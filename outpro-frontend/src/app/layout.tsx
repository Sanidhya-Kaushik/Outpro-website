// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, DM_Sans, DM_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/components/shared/Providers';
import { ToastRenderer } from '@/components/ui/Toast';

// ── Font loading (next/font — zero CLS) ────────────────────────────────────

const dmSerifDisplay = DM_Serif_Display({
  weight: ['400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

const dmSans = DM_Sans({
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: new URL('https://www.outpro.india'),
  title: {
    template: '%s | Outpro.India',
    default: 'Outpro.India — Corporate Digital Presence Platform',
  },
  description:
    'We build digital presence that drives real business growth. ' +
    'Website Development, UI/UX Design, SEO, Digital Marketing, Mobile Apps & Branding.',
  keywords: [
    'web development India',
    'digital agency Delhi',
    'UI UX design',
    'SEO services',
    'mobile app development',
    'branding agency',
    'Next.js development',
    'React development India',
  ],
  authors: [{ name: 'Outpro.India', url: 'https://www.outpro.india' }],
  creator: 'Outpro.India',
  publisher: 'Outpro.India',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://www.outpro.india',
    siteName: 'Outpro.India',
    title: 'Outpro.India — Corporate Digital Presence Platform',
    description:
      'We build digital presence that drives real business growth — Delhi, India.',
    images: [
      {
        url: '/og/home.jpg',
        width: 1200,
        height: 630,
        alt: 'Outpro.India — Digital Agency',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Outpro.India — Corporate Digital Presence Platform',
    description: 'Digital presence that drives real business growth.',
    images: ['/og/home.jpg'],
    creator: '@outproindia',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-16.png', type: 'image/png', sizes: '16x16' },
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://www.outpro.india',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F4C81',
};

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${dmSans.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.sanity.io" />
        {/* reCAPTCHA */}
        <script
          src="https://www.google.com/recaptcha/api.js?render=explicit"
          async
          defer
        />
      </head>
      <body className="font-body antialiased bg-neutral-50 text-neutral-900">
        <Providers>
          {/* Skip to main content — accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] btn-primary"
          >
            Skip to main content
          </a>
          {children}
          <ToastRenderer />
        </Providers>
      </body>
    </html>
  );
}
