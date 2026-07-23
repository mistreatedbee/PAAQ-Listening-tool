'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Render children unstyled on the server to avoid hydration mismatch.
  // The theme class is applied only after mount on the client.
  if (!mounted) return <>{children}</>

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
