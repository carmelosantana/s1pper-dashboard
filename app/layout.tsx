import type { Metadata } from 'next'

import UmamiAnalytics from '@/components/umami-analytics'
import { WebSocketProvider } from '@/lib/contexts/websocket-context'
import './globals.css'
import { Roboto, Roboto_Mono } from 'next/font/google'

// Initialize fonts
const roboto = Roboto({ 
  subsets: ['latin'], 
  weight: ["300", "400", "500", "700"],
  display: 'swap',
  variable: '--font-roboto'
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ["300", "400", "500", "700"],
  display: 'swap',
  variable: '--font-roboto-mono'
})

export const metadata: Metadata = {
  title: "s1pper's Dashboard",
  description: "A dashboard for s1pper, the Ender 3 S1 Pro",
  keywords: "3D printed, s1pper, Klipper, Ender 3 S1 Pro",
  generator: 'carmelosantana',
  icons: {
    icon: [
      {
        url: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/favicon-32x32.png',
        sizes: '32x32', 
        type: 'image/png',
      },
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${roboto.variable} ${robotoMono.variable}`}>
      <body className={`${roboto.className} antialiased`}>
        <WebSocketProvider autoConnect={true}>
          {children}
        </WebSocketProvider>
        <UmamiAnalytics 
          websiteId={process.env.UMAMI_WEBSITE_ID}
          hostUrl={process.env.UMAMI_HOST_URL}
        />
      </body>
    </html>
  )
}
