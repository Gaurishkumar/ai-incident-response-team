'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, UserCheck, XCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api, ApiClientError } from '@/lib/api'
import type { OrganizationJoinRequestResponse } from '@/lib/types'
import { Navbar } from '@/components/shared/Navbar'
import { Button } from '@/components/ui/button'

export default function OrgAdminJoinRequestsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [requests, setRequests] = useState<OrganizationJoinRequestResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.orgAdmin.joinRequests()
      setRequests(data)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          router.push('/login')
          return
        }
        if (err.status === 403) {
          router.push('/dashboard')
          return
        }
        setError(err.message)
      } else {
        setError('Failed to load join requests.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!authLoading && user && user.role !== 'ORG_ADMIN') {
      router.push('/dashboard')
    }
  }, [authLoading, isAuthenticated, router, user])

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ORG_ADMIN') {
      fetchRequests()
    }
  }, [fetchRequests, isAuthenticated, user?.role])

  const approve = async (requestId: string) => {
    setBusyId(requestId)
    setError(null)
    try {
      await api.orgAdmin.approveJoinRequest(requestId)
      await fetchRequests()
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
      } else {
        setError('Failed to approve join request.')
      }
    } finally {
      setBusyId(null)
    }
  }

  const reject = async (requestId: string) => {
    const reason = window.prompt('Reason for rejection')
    if (!reason || !reason.trim()) return

    setBusyId(requestId)
    setError(null)
    try {
      await api.orgAdmin.rejectJoinRequest(requestId, reason.trim())
      await fetchRequests()
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
      } else {
        setError('Failed to reject join request.')
      }
    } finally {
      setBusyId(null)
    }
  }

  if (authLoading || !isAuthenticated || user?.role !== 'ORG_ADMIN') return null

  return (
    <div className="min-h-dvh bg-ops-grid" style={{ background: 'var(--bg-void)' }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="heading-hero text-2xl sm:text-3xl text-ink-primary">Join Requests</h1>
            <p className="text-sm text-ink-secondary mt-1 font-mono">
              Approve or reject users waiting to join your organization
            </p>
          </div>

          <Button variant="ghost" size="sm" onClick={fetchRequests} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-lg border border-alert/30 bg-alert/8">
            <AlertTriangle className="w-4 h-4 text-alert shrink-0 mt-0.5" />
            <p className="text-sm text-alert">{error}</p>
          </div>
        )}

        <div className="card-ops overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="heading-section text-lg text-ink-primary">Pending Join Requests</h2>
              <p className="text-xs text-ink-muted mt-1">
                {user?.organizationName ?? 'Your organization'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <UserCheck className="w-4 h-4" />
              {requests.length} pending
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-ink-muted">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-sm text-ink-muted">
              No pending join requests right now.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((request) => (
                <div key={request.id} className="p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center text-amber">
                        {request.username?.slice(0, 1)?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-primary">
                          {request.username ?? 'Unknown user'}
                        </p>
                        <p className="text-xs text-ink-secondary">{request.email ?? request.userId}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-muted font-mono">
                      <span className="px-2 py-1 rounded-full border border-border">status: {request.status}</span>
                      <span className="px-2 py-1 rounded-full border border-border">user: {request.userId}</span>
                      <span className="px-2 py-1 rounded-full border border-border">
                        {new Date(request.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => approve(request.id)}
                      disabled={busyId === request.id}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reject(request.id)}
                      disabled={busyId === request.id}
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
