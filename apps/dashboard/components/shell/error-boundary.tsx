'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level error boundary that catches React render errors and shows
 * a graceful fallback instead of a white screen. Improves retention by
 * preventing crashes from blocking the entire app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in dev, would send to error tracking service in prod
    console.error('ErrorBoundary caught:', error, errorInfo)
    
    // TODO: Send to error tracking (Sentry/Datadog/PAAQ's own error API)
    // if (typeof window !== 'undefined' && window.paaq) {
    //   window.paaq.trackError(error, {
    //     componentStack: errorInfo.componentStack,
    //     boundary: 'root',
    //   })
    // }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen items-center justify-center px-6 py-12 bg-background">
          <div className="w-full max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-critical/10 text-critical">
                <AlertTriangle className="h-8 w-8" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Something went wrong
            </h1>
            <p className="mb-8 text-sm text-muted-foreground">
              We encountered an unexpected error. This has been logged and we'll look into it.
              Try refreshing the page or return home.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-8 rounded-lg bg-muted/50 p-4 text-left">
                <p className="mb-2 text-xs font-semibold text-foreground">
                  Error details (dev only):
                </p>
                <pre className="overflow-x-auto text-xs text-muted-foreground">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh page
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Home className="h-4 w-4" />
                Go home
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
