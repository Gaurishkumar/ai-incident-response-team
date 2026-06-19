'use client'

import { AlertTriangle, RefreshCw, WifiOff, X } from 'lucide-react'

interface ErrorBannerProps {
  code?: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}

export function ErrorBanner({ code, message, onRetry, onDismiss }: ErrorBannerProps) {
  const isTimeout = code === 'TIMEOUT' || code === 'NETWORK_ERROR'
  const isRateLimit = code === 'RATE_LIMIT_EXCEEDED'

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl border animate-slide-up-fade"
      style={{
        background: 'rgba(255,32,64,0.08)',
        borderColor: 'rgba(255,32,64,0.25)',
      }}
    >
      <span className="shrink-0 mt-0.5">
        {isTimeout ? (
          <WifiOff className="w-4 h-4 text-alert" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-alert" />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-display font-600 text-alert mb-0.5">
          {isRateLimit ? 'Rate Limited' : isTimeout ? 'Connection Lost' : 'Error'}
        </p>
        <p className="text-xs text-ink-secondary leading-relaxed">{message}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border text-alert border-alert/30 hover:bg-alert/10 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-alert/10 transition-colors text-alert/60 hover:text-alert"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
