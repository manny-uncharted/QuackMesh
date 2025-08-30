import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navigation } from '@/components/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'QuackMesh - Decentralized AI Training',
  description: 'Train AI. Protect Privacy. Earn $DUCK.',
  keywords: 'AI, machine learning, blockchain, privacy, decentralized, federated learning',
  authors: [{ name: 'QuackMesh Team' }],
  openGraph: {
    title: 'QuackMesh - Decentralized AI Training',
    description: 'Train AI. Protect Privacy. Earn $DUCK.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Navigation />
          {children}
        </Providers>
      </body>
    </html>
  )
}