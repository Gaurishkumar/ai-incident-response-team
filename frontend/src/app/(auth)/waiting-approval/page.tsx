'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Clock3, ArrowRight } from 'lucide-react'

function WaitingApprovalContent() {
  const params = useSearchParams()
  const step = params.get('step')
  const org = params.get('org')

  const isJoinRequest = step === 'PENDING_JOIN_APPROVAL'
  const title = isJoinRequest ? 'Join Request Submitted' : 'Organization Request Submitted'
  const message = isJoinRequest
    ? `Your request to join ${org || 'the organization'} is waiting for an org admin to approve it.`
    : `Your organization request for ${org || 'your organization'} is waiting for super admin approval.`

  return (
    <div className="min-h-dvh bg-ops-grid flex items-center justify-center p-4" style={{ background: 'var(--bg-void)' }}>
      <div className="orb orb-amber w-96 h-96 -top-20 -right-20 opacity-50 fixed" />
      <div className="orb orb-cyan w-80 h-80 bottom-0 -left-10 opacity-40 fixed" />

      <div className="w-full max-w-md relative z-10 animate-slide-up-fade">
        <div
          className="h-px w-full rounded-t-xl"
          style={{ background: 'linear-gradient(90deg, transparent, var(--amber), var(--cyan), transparent)' }}
        />

        <div className="card-ops p-8 rounded-b-xl rounded-t-none text-center">
          <Clock3 className="w-12 h-12 text-amber mx-auto mb-4" />
          <h1 className="heading-hero text-3xl text-ink-primary mb-2">{title}</h1>
          <p className="text-sm text-ink-secondary leading-relaxed mb-6">{message}</p>

          <div className="mb-6 flex items-start gap-3 p-3 rounded-lg border border-amber/30 bg-amber/8 text-left">
            <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
            <p className="text-xs text-amber leading-relaxed">
              You cannot log in until the approval step is completed.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-bg-elevated text-ink-primary hover:border-amber/40 transition-colors"
          >
            Back to login
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function WaitingApprovalPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-void" />}>
      <WaitingApprovalContent />
    </Suspense>
  )
}
