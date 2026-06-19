import { cn } from '@/lib/utils'
import type { Severity } from '@/lib/types'

const CONFIG: Record<Severity, { dot: string; border: string; text: string; bg: string; label: string }> = {
  P1: { dot: '#FF2040', border: 'rgba(255,32,64,0.4)',  text: '#FF2040', bg: 'rgba(255,32,64,0.08)',  label: 'P1 CRITICAL' },
  P2: { dot: '#FB923C', border: 'rgba(251,146,60,0.4)', text: '#FB923C', bg: 'rgba(251,146,60,0.08)', label: 'P2 HIGH'     },
  P3: { dot: '#FCD34D', border: 'rgba(252,211,77,0.4)', text: '#FCD34D', bg: 'rgba(252,211,77,0.08)', label: 'P3 MEDIUM'   },
  P4: { dot: '#60A5FA', border: 'rgba(96,165,250,0.4)', text: '#60A5FA', bg: 'rgba(96,165,250,0.08)', label: 'P4 LOW'      },
}

interface SeverityBadgeProps {
  severity: Severity
  className?: string
  showDot?: boolean
}

export function SeverityBadge({ severity, className, showDot = true }: SeverityBadgeProps) {
  const c = CONFIG[severity]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border', className)}
      style={{ color: c.text, background: c.bg, borderColor: c.border }}
    >
      {showDot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: c.dot, boxShadow: `0 0 4px ${c.dot}` }}
        />
      )}
      {c.label}
    </span>
  )
}
