import type { Metadata } from 'next'
import { AdminShell } from '@/components/shell/admin-shell'
import './globals.css'

export const metadata: Metadata = {
  title: 'PAAQ Super Admin',
  description: 'PAAQ Intelligence Platform — Super Admin Control Center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  )
}
