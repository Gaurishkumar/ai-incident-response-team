'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Shield, XCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api, ApiClientError } from '@/lib/api'
import type { OrganizationRequestResponse, OrganizationResponse } from '@/lib/types'
import { Navbar } from '@/components/shared/Navbar'
import { Button } from '@/components/ui/button'

export default function AdminOrganizationsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [requests, setRequests] = useState<OrganizationRequestResponse[]>([])
  const [organizations, setOrganizations] = useState<OrganizationResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [pending, approved] = await Promise.all([
        api.admin.organizationRequests(),
        api.admin.organizations(),
      ])
      setRequests(pending)
      setOrganizations(approved)
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
        setError('Failed to load organization approvals.')
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

    if (!authLoading && user && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
    }
  }, [authLoading, isAuthenticated, router, user])

  useEffect(() => {
    if (isAuthenticated && user?.role === 'SUPER_ADMIN') {
      fetchData()
    }
  }, [fetchData, isAuthenticated, user?.role])

  const approve = async (requestId: string) => {
    setBusyId(requestId)
    setError(null)
    try {
      await api.admin.approveOrganizationRequest(requestId)
      await fetchData()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to approve organization request.')
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
      await api.admin.rejectOrganizationRequest(requestId, reason.trim())
      await fetchData()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to reject organization request.')
    } finally {
      setBusyId(null)
    }
  }

  if (authLoading || !isAuthenticated || user?.role !== 'SUPER_ADMIN') return null

  return (
    <div className="min-h-dvh bg-ops-grid" style={{ background: 'var(--bg-void)' }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="heading-hero text-2xl sm:text-3xl text-ink-primary">Organization Approvals</h1>
            <p className="text-sm text-ink-secondary mt-1 font-mono">
              Review pending org requests and manage approved organizations
            </p>
          </div>

          <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-alert/30 bg-alert/8">
            <AlertTriangle className="w-4 h-4 text-alert shrink-0 mt-0.5" />
            <p className="text-sm text-alert">{error}</p>
          </div>
        )}

        <section className="card-ops overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="heading-section text-lg text-ink-primary">Pending Requests</h2>
              <p className="text-xs text-ink-muted mt-1">Approve exactly one request per domain</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <Shield className="w-4 h-4" />
              {requests.length} pending
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-ink-muted">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-sm text-ink-muted">No pending organization requests.</div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((request) => (
                <div key={request.id} className="p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-primary">{request.orgName}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-muted font-mono">
                      <span className="px-2 py-1 rounded-full border border-border">domain: {request.domainKey}</span>
                      <span className="px-2 py-1 rounded-full border border-border">status: {request.status}</span>
                      <span className="px-2 py-1 rounded-full border border-border">user: {request.requestedByUserId}</span>
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
        </section>

        <section className="card-ops overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="heading-section text-lg text-ink-primary">Approved Organizations</h2>
              <p className="text-xs text-ink-muted mt-1">Active orgs already approved by super admin</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <CheckCircle2 className="w-4 h-4" />
              {organizations.length} approved
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-ink-muted">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading organizations...
            </div>
          ) : organizations.length === 0 ? (
            <div className="p-8 text-sm text-ink-muted">No approved organizations yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {organizations.map((org) => (
                <div key={org.id} className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-primary">{org.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink-muted font-mono">
                      <span className="px-2 py-1 rounded-full border border-border">domain: {org.domainKey}</span>
                      <span className="px-2 py-1 rounded-full border border-border">owner: {org.ownerUserId}</span>
                      <span className="px-2 py-1 rounded-full border border-border">status: {org.status}</span>
                    </div>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {org.approvedAt ? new Date(org.approvedAt).toLocaleString() : 'Not set'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
