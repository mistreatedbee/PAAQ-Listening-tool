import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AppShell } from '@/components/shell/app-shell'
import { ErrorBoundary } from '@/components/shell/error-boundary'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'PAAQ Intelligence — AI-Native Product Intelligence Platform',
  description:
    'AI-powered product intelligence for modern teams. Monitor user behavior, detect errors automatically, replay sessions, and get AI-generated insights — all in one platform. Free tier with 25K events/month.',
  keywords: [
    'product intelligence',
    'AI analytics',
    'session replay',
    'error tracking',
    'product analytics',
    'user monitoring',
    'developer tools',
    'AI insights',
    'crash reporting',
    'product observability',
  ],
  authors: [{ name: 'PAAQ Intelligence' }],
  creator: 'PAAQ Intelligence',
  publisher: 'PAAQ Intelligence',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://paaq.ai',
    title: 'PAAQ Intelligence — AI-Native Product Intelligence',
    description:
      'Ship better products with AI-powered intelligence. Session replay, error tracking, and insights that help you understand and improve your product. Start free.',
    siteName: 'PAAQ Intelligence',
    images: [
      {
        url: '/og-image.png', // TODO: create an actual OG image
        width: 1200,
        height: 630,
        alt: 'PAAQ Intelligence Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PAAQ Intelligence — AI-Native Product Intelligence',
    description:
      'AI-powered product intelligence: session replay, error tracking, and insights that help you ship better products. Start free with 25K events/month.',
    images: ['/og-image.png'], // TODO: create an actual OG image
    creator: '@paaqai', // TODO: update to real Twitter handle if exists
  },
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
  verification: {
    // google: 'your-google-site-verification', // TODO: add after Google Search Console setup
    // yandex: 'your-yandex-verification',
    // bing: 'your-bing-verification',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="bg-background font-sans antialiased">
        <ErrorBoundary>
          <ThemeProvider>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </ErrorBoundary>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
