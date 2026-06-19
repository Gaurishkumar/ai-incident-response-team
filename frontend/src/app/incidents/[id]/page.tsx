'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, CheckCircle2, RotateCcw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api, ApiClientError } from '@/lib/api'
import type { IncidentDetailResponse, IncidentStatus, AgentRunSummary } from '@/lib/types'
import { useIncidentPolling } from '@/hooks/useIncidentPolling'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Navbar } from '@/components/shared/Navbar'
import { SeverityBadge } from '@/components/shared/SeverityBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AgentTimeline } from '@/components/incidents/AgentTimeline'
import { AnalysisTabs } from '@/components/incidents/AnalysisTabs'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { ENV_LABELS, formatDateTime, formatRelativeTime } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

const ACTIVE_STATUSES: IncidentStatus[] = ['PENDING', 'ANALYZING']

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [incident, setIncident] = useState<IncidentDetailResponse | null>(null)
  const [agentRuns, setAgentRuns] = useState<AgentRunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const resolvedToastShownRef = useRef(false)

  const isActive = incident ? ACTIVE_STATUSES.includes(incident.status) : false

  // Initial load
  const fetchFull = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.incidents.get(id)
      setIncident(data)
      setAgentRuns(data.agentRuns ?? [])
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) { router.push('/login'); return }
        if (err.status === 404) { router.push('/dashboard'); return }
        setError({ code: err.code, message: err.message })
      } else {
        setError({ code: 'UNKNOWN', message: 'Failed to load incident.' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) fetchFull()
  }, [isAuthenticated, fetchFull])

  // Status polling (runs while incident is PENDING or ANALYZING)
  const { statusData } = useIncidentPolling({
    incidentId: id!,
    enabled: isAuthenticated && !authLoading && isActive,
    onResolved: () => {
      fetchFull()
    },
  })

  // Update agent runs from polling data
  useEffect(() => {
    if (statusData) {
      setAgentRuns(statusData.agentRuns)
      setIncident((prev) =>
        prev ? { ...prev, status: statusData.status, agentRuns: statusData.agentRuns } : prev,
      )
    }
  }, [statusData])

  // WebSocket for instant push when resolved
  useWebSocket({
    incidentId: id!,
    enabled: isAuthenticated && !authLoading && isActive,
    onMessage: (msg) => {
      if (msg.type === 'INCIDENT_RESOLVED' && !resolvedToastShownRef.current) {
        resolvedToastShownRef.current = true
        fetchFull()
        const isSuccess = msg.analysisStatus === 'COMPLETED' || msg.analysisStatus === 'PARTIAL'
        toast({
          variant: isSuccess ? 'success' : 'error',
          title: isSuccess ? 'Analysis Complete' : 'Analysis Failed',
          description: isSuccess
            ? 'Root cause and recommendations are ready.'
            : 'The AI pipeline encountered errors.',
        })
      }
    },
  })

  if (authLoading || isLoading) {
    return (
      <div className="min-h-dvh bg-ops-grid flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
        <Navbar />
        <div className="flex flex-col items-center gap-4 mt-20">
          <div className="w-8 h-8 rounded-full border-2 border-amber border-t-transparent animate-spin" />
          <p className="text-sm font-mono text-ink-muted">Loading incident…</p>
        </div>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="min-h-dvh bg-ops-grid" style={{ background: 'var(--bg-void)' }}>
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-12">
          {error && <ErrorBanner code={error.code} message={error.message} onRetry={fetchFull} />}
        </div>
      </div>
    )
  }

  const isTerminal = !ACTIVE_STATUSES.includes(incident.status)

  return (
    <div className="min-h-dvh bg-ops-grid" style={{ background: 'var(--bg-void)' }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ─── Incident Header ──────────────────────────────────────────── */}
        <div className="mb-8 stagger-child animate-slide-up-fade">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="mb-5 -ml-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Button>

          <div className="card-ops p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1 min-w-0">
                {/* Status + severity row */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <SeverityBadge severity={incident.severity} />
                  <StatusBadge status={incident.status} size="sm" />
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded border"
                    style={{
                      color: incident.environment === 'production' ? '#FF2040' : incident.environment === 'staging' ? '#F59E0B' : '#60A5FA',
                      borderColor: incident.environment === 'production' ? 'rgba(255,32,64,0.3)' : incident.environment === 'staging' ? 'rgba(245,158,11,0.3)' : 'rgba(96,165,250,0.3)',
                      background: incident.environment === 'production' ? 'rgba(255,32,64,0.06)' : incident.environment === 'staging' ? 'rgba(245,158,11,0.06)' : 'rgba(96,165,250,0.06)',
                    }}
                  >
                    {ENV_LABELS[incident.environment] ?? incident.environment.toUpperCase()}
                  </span>
                </div>

                {/* Title */}
                <h1 className="heading-section text-xl sm:text-2xl text-ink-primary mb-2 leading-snug">
                  {incident.title}
                </h1>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-ink-muted">
                  <span>ID: {incident.id.slice(0, 8)}…</span>
                  <span>Created {formatRelativeTime(incident.createdAt)}</span>
                  {incident.resolvedAt && (
                    <span className="text-ok">Resolved {formatRelativeTime(incident.resolvedAt)}</span>
                  )}
                </div>

                {/* Services */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {incident.affectedServices.map((s) => (
                    <span key={s} className="tag">{s}</span>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={fetchFull}>
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                {isTerminal && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Re-run: just re-fetch for now — actual re-run would be a new endpoint
                      toast({ variant: 'default', title: 'Re-run Analysis', description: 'Re-run endpoint not yet implemented in V1.' })
                    }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Re-run
                  </Button>
                )}
              </div>
            </div>

            {/* Analyzing progress bar */}
            {isActive && (
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-cyan uppercase tracking-wider">
                    AI Analysis Running
                  </span>
                  <span className="text-[11px] font-mono text-ink-muted">
                    ~60–120s total
                  </span>
                </div>
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--border)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(90deg, var(--cyan), var(--amber), var(--ok))',
                      backgroundSize: '200% 100%',
                      animation: 'ops-data-flash 2s linear infinite',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Completed banner */}
            {incident.status === 'RESOLVED' && (
              <div
                className="mt-5 pt-4 border-t border-ok/20 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-ok" />
                <span className="text-xs font-mono text-ok">
                  Analysis completed — {formatDateTime(incident.resolvedAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Main Content ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Agent timeline */}
          <div className="lg:col-span-2 stagger-child animate-slide-up-fade delay-100">
            <AgentTimeline agentRuns={agentRuns} />
          </div>

          {/* Analysis tabs */}
          <div className="lg:col-span-3 stagger-child animate-slide-up-fade delay-200">
            <AnalysisTabs
              incident={incident}
              locked={ACTIVE_STATUSES.includes(incident.status)}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6">
            <ErrorBanner code={error.code} message={error.message} onRetry={fetchFull} onDismiss={() => setError(null)} />
          </div>
        )}
      </main>
    </div>
  )
}
