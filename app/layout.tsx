import type { Metadata, Viewport } from 'next'
import { Baloo_2, Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const baloo2 = Baloo_2({
  subsets: ['latin', 'devanagari'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-baloo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Munafa — Daily Profit Coach',
  description:
    'Voice-first daily profit intelligence for Indian street vendors. Speak your sales in Hindi — get your profit on WhatsApp.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Munafa',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0F3D2E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${baloo2.variable}`}>
      <head>
        {/* Apple PWA splash / icon */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className="font-sans antialiased bg-cream-50 text-charcoal-800"
        style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
      >
        {children}

        {/* Service Worker registration */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker
                    .register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('[Munafa SW] Registered:', reg.scope);
                    })
                    .catch(function(err) {
                      console.warn('[Munafa SW] Registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}

