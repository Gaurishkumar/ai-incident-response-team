'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api, ApiClientError } from '@/lib/api'
import type { DashboardStats, PagedIncidents } from '@/lib/types'
import { Navbar } from '@/components/shared/Navbar'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { IncidentTable } from '@/components/dashboard/IncidentTable'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/shared/ErrorBanner'

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [incidents, setIncidents] = useState<PagedIncidents | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [s, i] = await Promise.all([
        api.dashboard.stats(),
        api.incidents.list({
          page: currentPage,
          size: 20,
          ...(filterStatus ? { status: filterStatus } : {}),
          ...(filterSeverity ? { severity: filterSeverity } : {}),
        }),
      ])
      setStats(s)
      setIncidents(i)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          router.push('/login')
          return
        }
        setError({ code: err.code, message: err.message })
      } else {
        setError({ code: 'UNKNOWN', message: 'Failed to load dashboard data.' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, filterStatus, filterSeverity, router])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) fetchData()
  }, [isAuthenticated, fetchData])

  if (authLoading) return null

  return (
    <div className="min-h-dvh bg-ops-grid" style={{ background: 'var(--bg-void)' }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8 stagger-child animate-slide-up-fade">
          <div>
            <h1 className="heading-hero text-2xl sm:text-3xl text-ink-primary">
              Incident Dashboard
            </h1>
            <p className="text-sm text-ink-secondary mt-1 font-mono">
              Real-time incident monitoring and AI-powered analysis
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={() => router.push('/incidents/new')}
            >
              <Plus className="w-4 h-4" />
              New Incident
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6">
            <ErrorBanner
              code={error.code}
              message={error.message}
              onRetry={fetchData}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {/* Stats */}
        {stats ? (
          <div className="mb-8">
            <StatsCards stats={stats} />
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card-ops h-32 animate-pulse" />
            ))}
          </div>
        ) : null}

        {/* Incident table */}
        {incidents ? (
          <IncidentTable
            incidents={incidents.content}
            totalPages={incidents.totalPages}
            currentPage={incidents.currentPage}
            onPageChange={(p) => setCurrentPage(p)}
            isLoading={isLoading}
            filterStatus={filterStatus}
            filterSeverity={filterSeverity}
            onFilterStatus={(v) => { setFilterStatus(v); setCurrentPage(0) }}
            onFilterSeverity={(v) => { setFilterSeverity(v); setCurrentPage(0) }}
          />
        ) : isLoading ? (
          <div className="card-ops h-64 animate-pulse" />
        ) : null}
      </main>
    </div>
  )
}
