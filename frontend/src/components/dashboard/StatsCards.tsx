'use client'

import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingUp, Zap } from 'lucide-react'
import type { DashboardStats } from '@/lib/types'

interface CardData {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accentColor: string
  glowColor: string
  delay: string
}

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards: CardData[] = [
    {
      label: 'Total Incidents',
      value: stats.totalIncidents.toLocaleString(),
      sub: `${stats.p1Count} P1 · ${stats.p2Count} P2`,
      icon: <Activity className="w-5 h-5" />,
      accentColor: '#F59E0B',
      glowColor: 'rgba(245,158,11,0.12)',
      delay: 'delay-50',
    },
    {
      label: 'Active Now',
      value: stats.activeIncidents,
      sub: 'Pending + Analyzing',
      icon: <Zap className="w-5 h-5" />,
      accentColor: '#22D3EE',
      glowColor: 'rgba(34,211,238,0.1)',
      delay: 'delay-100',
    },
    {
      label: 'Resolved Today',
      value: stats.resolvedToday,
      sub: `${stats.failedToday} failed`,
      icon: <CheckCircle2 className="w-5 h-5" />,
      accentColor: '#00FFA3',
      glowColor: 'rgba(0,255,163,0.1)',
      delay: 'delay-150',
    },
    {
      label: 'Avg Resolution',
      value: stats.avgResolutionMinutes > 0
        ? `${stats.avgResolutionMinutes.toFixed(1)}m`
        : '—',
      sub: 'AI pipeline duration',
      icon: <Clock className="w-5 h-5" />,
      accentColor: '#FB923C',
      glowColor: 'rgba(251,146,60,0.1)',
      delay: 'delay-200',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`card-ops p-5 stagger-child animate-slide-up-fade ${card.delay} group relative overflow-hidden`}
        >
          {/* Ambient glow behind icon */}
          <div
            className="absolute top-3 right-3 w-20 h-20 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: `radial-gradient(circle, ${card.glowColor} 0%, transparent 70%)` }}
          />

          {/* Icon */}
          <div
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-4 relative z-10"
            style={{ color: card.accentColor, background: `${card.glowColor}`, border: `1px solid ${card.accentColor}20` }}
          >
            {card.icon}
          </div>

          {/* Value */}
          <div
            className="font-display text-3xl font-800 leading-none mb-1 relative z-10"
            style={{ color: card.accentColor }}
          >
            {card.value}
          </div>

          {/* Label */}
          <div className="text-xs font-mono font-medium uppercase tracking-widest text-ink-secondary mb-1 relative z-10">
            {card.label}
          </div>

          {/* Sub */}
          {card.sub && (
            <div className="text-[11px] font-mono text-ink-muted relative z-10">{card.sub}</div>
          )}

          {/* Bottom accent line */}
          <div
            className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500"
            style={{ background: `linear-gradient(90deg, ${card.accentColor}, transparent)` }}
          />
        </div>
      ))}
    </div>
  )
}
