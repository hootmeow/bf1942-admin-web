import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'BF1942 Server Manager',
  description: 'Battlefield 1942 server administration dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${mono.variable} font-sans bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  )
}
