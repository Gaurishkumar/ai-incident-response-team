'use client'

import { cn } from '@/lib/utils'
import type { IncidentStatus } from '@/lib/types'

const CONFIG: Record<IncidentStatus, { color: string; bg: string; border: string; label: string; pulse: boolean }> = {
  PENDING:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.35)', label: 'PENDING',   pulse: true  },
  ANALYZING: { color: '#22D3EE', bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.35)', label: 'ANALYZING', pulse: true  },
  RESOLVED:  { color: '#00FFA3', bg: 'rgba(0,255,163,0.08)',   border: 'rgba(0,255,163,0.35)',  label: 'RESOLVED',  pulse: false },
  FAILED:    { color: '#FF2040', bg: 'rgba(255,32,64,0.08)',   border: 'rgba(255,32,64,0.35)',  label: 'FAILED',    pulse: false },
}

interface StatusBadgeProps {
  status: IncidentStatus
  className?: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, className, size = 'sm' }: StatusBadgeProps) {
  const c = CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-mono font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className,
      )}
      style={{ color: c.color, background: c.bg, borderColor: c.border }}
    >
      <span className="relative inline-flex w-1.5 h-1.5 shrink-0">
        {c.pulse && (
          <span
            className="absolute inline-flex w-full h-full rounded-full opacity-75"
            style={{ background: c.color, animation: 'ops-pulse-ring 1.4s ease-out infinite' }}
          />
        )}
        <span
          className="relative inline-flex w-1.5 h-1.5 rounded-full"
          style={{ background: c.color }}
        />
      </span>
      {c.label}
    </span>
  )
}
