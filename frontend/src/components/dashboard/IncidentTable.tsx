'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ExternalLink, Inbox } from 'lucide-react'
import type { IncidentSummary, IncidentStatus, Severity } from '@/lib/types'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ENV_LABELS, formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface IncidentTableProps {
  incidents: IncidentSummary[]
  totalPages: number
  currentPage: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  filterStatus: string
  filterSeverity: string
  onFilterStatus: (v: string) => void
  onFilterSeverity: (v: string) => void
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING',   label: 'Pending' },
  { value: 'ANALYZING', label: 'Analyzing' },
  { value: 'RESOLVED',  label: 'Resolved' },
  { value: 'FAILED',    label: 'Failed' },
]

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Severities' },
  { value: 'P1', label: 'P1 Critical' },
  { value: 'P2', label: 'P2 High' },
  { value: 'P3', label: 'P3 Medium' },
  { value: 'P4', label: 'P4 Low' },
]

const ROW_SEVERITY_BORDER: Record<Severity, string> = {
  P1: 'rgba(255,32,64,0.5)',
  P2: 'rgba(251,146,60,0.4)',
  P3: 'rgba(252,211,77,0.3)',
  P4: 'rgba(96,165,250,0.3)',
}

export function IncidentTable({
  incidents,
  totalPages,
  currentPage,
  onPageChange,
  isLoading,
  filterStatus,
  filterSeverity,
  onFilterStatus,
  onFilterSeverity,
}: IncidentTableProps) {
  const router = useRouter()

  return (
    <div className="card-ops overflow-hidden stagger-child animate-slide-up-fade delay-300">
      {/* Table header + filters */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="font-display font-700 text-sm uppercase tracking-wider text-ink-secondary">
          Recent Incidents
        </h2>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatus(e.target.value)}
            className="input-ops h-8 px-2 text-xs"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => onFilterSeverity(e.target.value)}
            className="input-ops h-8 px-2 text-xs"
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-amber border-t-transparent animate-spin" />
            <span className="text-xs font-mono text-ink-muted">Loading incidents…</span>
          </div>
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Inbox className="w-8 h-8 text-ink-muted" />
          <p className="text-sm text-ink-muted font-mono">No incidents found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-ops">
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Environment</th>
                <th>Services</th>
                <th>Submitted</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc, i) => (
                <tr
                  key={inc.id}
                  onClick={() => router.push(`/incidents/${inc.id}`)}
                  style={{
                    opacity: 0,
                    animation: `ops-slide-up-fade 0.4s ease-out ${i * 40}ms forwards`,
                  }}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      {/* Left severity accent bar */}
                      <div
                        className="w-0.5 h-8 rounded-full shrink-0"
                        style={{ background: ROW_SEVERITY_BORDER[inc.severity] }}
                      />
                      <div>
                        <div className="text-ink-primary font-medium text-sm leading-snug max-w-[240px] truncate">
                          {inc.title}
                        </div>
                        <div className="text-[11px] font-mono text-ink-muted mt-0.5 truncate max-w-[200px]">
                          {inc.id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <SeverityBadge severity={inc.severity} />
                  </td>
                  <td>
                    <StatusBadge status={inc.status} />
                  </td>
                  <td>
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded border"
                      style={{
                        color: inc.environment === 'production' ? '#FF2040' : inc.environment === 'staging' ? '#F59E0B' : '#60A5FA',
                        borderColor: inc.environment === 'production' ? 'rgba(255,32,64,0.3)' : inc.environment === 'staging' ? 'rgba(245,158,11,0.3)' : 'rgba(96,165,250,0.3)',
                        background: inc.environment === 'production' ? 'rgba(255,32,64,0.06)' : inc.environment === 'staging' ? 'rgba(245,158,11,0.06)' : 'rgba(96,165,250,0.06)',
                      }}
                    >
                      {ENV_LABELS[inc.environment] ?? inc.environment.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {inc.affectedServices.slice(0, 2).map((s) => (
                        <span key={s} className="tag">{s}</span>
                      ))}
                      {inc.affectedServices.length > 2 && (
                        <span className="text-[11px] font-mono text-ink-muted self-center">
                          +{inc.affectedServices.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="text-xs font-mono text-ink-muted">
                      {formatRelativeTime(inc.createdAt)}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/incidents/${inc.id}`)
                      }}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-amber hover:bg-amber/10 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-xs font-mono text-ink-muted">
            Page {currentPage + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
