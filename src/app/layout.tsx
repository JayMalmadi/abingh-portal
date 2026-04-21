import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Abingh Client Portal',
  description: 'Client management portal for Abingh Accountancy',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
