'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Navbar } from '@/components/shared/Navbar'
import { SubmissionForm } from '@/components/incidents/SubmissionForm'
import { Button } from '@/components/ui/button'

export default function NewIncidentPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login')
  }, [isLoading, isAuthenticated, router])

  if (isLoading) return null

  return (
    <div className="min-h-dvh bg-ops-grid" style={{ background: 'var(--bg-void)' }}>
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 stagger-child animate-slide-up-fade">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="mb-4 -ml-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-start gap-4">
            <div>
              <h1 className="heading-hero text-2xl sm:text-3xl text-ink-primary">
                Submit Incident
              </h1>
              <p className="text-sm text-ink-secondary mt-2 leading-relaxed max-w-xl">
                Fill in all 10 required fields. After submission, the AI pipeline will run
                log analysis, root cause detection, and generate remediation recommendations
                — typically completing in 60–120 seconds.
              </p>
            </div>
          </div>

          {/* Pipeline preview */}
          <div className="flex items-center gap-3 mt-5 p-4 rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-2">
              {[
                { label: 'Log Analysis', color: '#22D3EE' },
                { label: 'Root Cause',   color: '#F59E0B' },
                { label: 'Remediation', color: '#00FFA3' },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-2">
                  {i > 0 && <div className="w-6 h-px" style={{ background: 'var(--border-bright)' }} />}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: step.color, boxShadow: `0 0 4px ${step.color}` }}
                    />
                    <span className="text-xs font-mono text-ink-secondary">{step.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="ml-auto">
              <span className="text-[11px] font-mono text-ink-muted">AI-powered · ~60–120s</span>
            </div>
          </div>
        </div>

        <SubmissionForm />
      </main>
    </div>
  )
}
