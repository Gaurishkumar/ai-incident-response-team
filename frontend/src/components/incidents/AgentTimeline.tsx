'use client'

import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { AgentRunSummary, AgentName, AgentStatus } from '@/lib/types'
import { AGENT_META, AGENT_STATUS_META, formatDuration, formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

const AGENT_ORDER: AgentName[] = ['LOG_ANALYSIS', 'ROOT_CAUSE', 'RECOMMENDATION']

function getStatusIcon(status: AgentStatus) {
  switch (status) {
    case 'COMPLETED': return <CheckCircle2 className="w-4 h-4 text-ok" />
    case 'FAILED':    return <XCircle className="w-4 h-4 text-alert" />
    case 'RUNNING':   return <Loader2 className="w-4 h-4 text-cyan animate-spin" />
    case 'PENDING':   return <Clock className="w-4 h-4 text-ink-muted" />
  }
}

function buildRunMap(agentRuns: AgentRunSummary[]): Map<AgentName, AgentRunSummary> {
  const map = new Map<AgentName, AgentRunSummary>()
  for (const run of agentRuns) map.set(run.agentName, run)
  return map
}

interface AgentCardProps {
  name: AgentName
  run: AgentRunSummary | undefined
  index: number
  isLast: boolean
}

function AgentCard({ name, run, index, isLast }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const meta = AGENT_META[name]
  const status: AgentStatus = run?.status ?? 'PENDING'
  const statusMeta = AGENT_STATUS_META[status]
  const isScanning = status === 'RUNNING'

  return (
    <div className="relative flex gap-4">
      {/* Vertical timeline line */}
      {!isLast && (
        <div
          className="absolute left-[17px] top-10 bottom-0 w-px"
          style={{
            background: status === 'COMPLETED'
              ? 'linear-gradient(to bottom, var(--ok), rgba(0,255,163,0.15))'
              : 'var(--border)',
          }}
        />
      )}

      {/* Node */}
      <div className="relative shrink-0 flex flex-col items-center" style={{ width: '36px' }}>
        <div
          className="relative flex items-center justify-center w-9 h-9 rounded-full border-2 z-10"
          style={{
            borderColor: statusMeta.color,
            background: status === 'COMPLETED'
              ? `rgba(0,255,163,0.1)`
              : status === 'RUNNING'
              ? `rgba(34,211,238,0.1)`
              : status === 'FAILED'
              ? `rgba(255,32,64,0.1)`
              : 'var(--bg-elevated)',
          }}
        >
          {isScanning && (
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: statusMeta.color, animation: 'ops-pulse-ring 1.2s ease-out infinite', opacity: 0.4 }}
            />
          )}
          <span className="text-base z-10" style={{ color: statusMeta.color }}>
            {meta.icon}
          </span>
        </div>

        {/* Index number */}
        <span
          className="text-[9px] font-mono mt-1"
          style={{ color: status === 'COMPLETED' ? 'var(--ok)' : 'var(--ink-muted)' }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      {/* Card */}
      <div
        className={cn(
          'flex-1 mb-5 rounded-xl border transition-all duration-300',
          isScanning && 'agent-scanning',
          status === 'COMPLETED' && 'border-ok/20 bg-ok/5',
          status === 'RUNNING'   && 'border-cyan/30 bg-cyan/5',
          status === 'FAILED'    && 'border-alert/20 bg-alert/5',
          status === 'PENDING'   && 'border-border bg-elevated/50 opacity-60',
        )}
      >
        {/* Card header */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer"
          onClick={() => run?.outputSummary && setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2.5">
            {getStatusIcon(status)}
            <div>
              <span className="font-display font-700 text-sm text-ink-primary">{meta.label} Agent</span>
              <p className="text-[11px] font-mono text-ink-muted mt-0.5">{meta.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-3">
            {/* Duration */}
            {run?.startedAt && (
              <div className="text-right hidden sm:block">
                <div
                  className="text-xs font-mono font-medium"
                  style={{ color: statusMeta.color }}
                >
                  {formatDuration(run.startedAt, run.finishedAt)}
                </div>
                <div className="text-[10px] font-mono text-ink-muted mt-0.5">
                  {formatTime(run.startedAt)}
                </div>
              </div>
            )}

            {/* Status badge */}
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border"
              style={{
                color: statusMeta.color,
                borderColor: `${statusMeta.color}40`,
                background: `${statusMeta.color}12`,
              }}
            >
              {statusMeta.label}
            </span>

            {/* Expand toggle */}
            {run?.outputSummary && (
              <button className="text-ink-muted hover:text-ink-secondary transition-colors">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Output summary */}
        {expanded && run?.outputSummary && (
          <div
            className="px-4 pb-4 border-t"
            style={{ borderColor: `${statusMeta.color}20` }}
          >
            <p className="text-xs font-mono text-ink-secondary leading-relaxed mt-3 whitespace-pre-line">
              {run.outputSummary}
            </p>
          </div>
        )}

        {/* Error message */}
        {status === 'FAILED' && run?.errorMessage && (
          <div className="px-4 pb-4 border-t border-alert/20">
            <p className="text-xs font-mono text-alert leading-relaxed mt-3">
              ✕ {run.errorMessage}
            </p>
          </div>
        )}

        {/* Retry count */}
        {run?.retryCount != null && run.retryCount > 0 && (
          <div className="px-4 pb-2">
            <span className="text-[10px] font-mono text-warn">
              ↺ Retried {run.retryCount}×
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

interface AgentTimelineProps {
  agentRuns: AgentRunSummary[]
}

export function AgentTimeline({ agentRuns }: AgentTimelineProps) {
  const runMap = buildRunMap(agentRuns)

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-display font-700 text-xs uppercase tracking-widest text-ink-muted">
          Agent Pipeline
        </h3>
        <div className="flex-1 h-px bg-border" />
      </div>

      {AGENT_ORDER.map((name, i) => (
        <AgentCard
          key={name}
          name={name}
          run={runMap.get(name)}
          index={i}
          isLast={i === AGENT_ORDER.length - 1}
        />
      ))}
    </div>
  )
}
