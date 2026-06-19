import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Severity, IncidentStatus, AgentStatus, AgentName } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const seconds = Math.round((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export const SEVERITY_META: Record<
  Severity,
  { label: string; colorClass: string; dotColor: string; order: number }
> = {
  P1: { label: 'P1 CRITICAL', colorClass: 'severity-p1', dotColor: '#FF2040', order: 1 },
  P2: { label: 'P2 HIGH',     colorClass: 'severity-p2', dotColor: '#FB923C', order: 2 },
  P3: { label: 'P3 MEDIUM',   colorClass: 'severity-p3', dotColor: '#FCD34D', order: 3 },
  P4: { label: 'P4 LOW',      colorClass: 'severity-p4', dotColor: '#60A5FA', order: 4 },
}

export const STATUS_META: Record<
  IncidentStatus,
  { label: string; color: string; pulse: boolean }
> = {
  PENDING:   { label: 'PENDING',   color: '#F59E0B', pulse: true },
  ANALYZING: { label: 'ANALYZING', color: '#22D3EE', pulse: true },
  RESOLVED:  { label: 'RESOLVED',  color: '#00FFA3', pulse: false },
  FAILED:    { label: 'FAILED',    color: '#FF2040', pulse: false },
}

export const AGENT_META: Record<
  AgentName,
  { label: string; description: string; icon: string }
> = {
  LOG_ANALYSIS:   { label: 'Log Analysis',   description: 'Parsing error patterns and exceptions', icon: '⬡' },
  ROOT_CAUSE:     { label: 'Root Cause',      description: 'Synthesizing failure cascade',          icon: '◈' },
  RECOMMENDATION: { label: 'Recommendation', description: 'Generating remediation actions',         icon: '◎' },
}

export const AGENT_STATUS_META: Record<
  AgentStatus,
  { label: string; color: string; scanning: boolean }
> = {
  PENDING:   { label: 'Queued',    color: '#4A5270', scanning: false },
  RUNNING:   { label: 'Running',   color: '#22D3EE', scanning: true  },
  COMPLETED: { label: 'Completed', color: '#00FFA3', scanning: false },
  FAILED:    { label: 'Failed',    color: '#FF2040', scanning: false },
}

export const ENV_LABELS: Record<string, string> = {
  production:  'PROD',
  staging:     'STAG',
  development: 'DEV',
}

export const PRIORITY_META: Record<
  string,
  { color: string; bg: string }
> = {
  Immediate:  { color: '#FF2040', bg: 'rgba(255,32,64,0.1)'  },
  'Short-term': { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  'Long-term':  { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
}

export const CATEGORY_ICONS: Record<string, string> = {
  Infrastructure: '⬡',
  'Code Bug':     '◈',
  Configuration:  '◉',
  External:       '◎',
  Unknown:        '?',
}
