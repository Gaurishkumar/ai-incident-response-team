'use client'

import { Lock, ShieldAlert, Lightbulb, FileCode2, BarChart3 } from 'lucide-react'
import type { IncidentDetailResponse } from '@/lib/types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CATEGORY_ICONS, PRIORITY_META, formatDateTime } from '@/lib/utils'

interface AnalysisTabsProps {
  incident: IncidentDetailResponse
  locked: boolean
}

export function AnalysisTabs({ incident, locked }: AnalysisTabsProps) {
  if (locked) {
    return (
      <div className="card-ops p-8 flex flex-col items-center justify-center gap-4 min-h-[320px]">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center border"
          style={{ borderColor: 'var(--border-bright)', background: 'var(--bg-elevated)' }}
        >
          <Lock className="w-6 h-6 text-ink-muted" />
        </div>
        <div className="text-center">
          <p className="font-display font-700 text-sm text-ink-secondary mb-1">Analysis in Progress</p>
          <p className="text-xs font-mono text-ink-muted leading-relaxed max-w-[240px]">
            Results will appear here once all three agents complete their analysis.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {['Log Analysis', 'Root Cause', 'Remediation'].map((s) => (
            <span
              key={s}
              className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-ink-muted"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    )
  }

  const { analysis, recommendations, rawLogs, metrics } = incident

  return (
    <Tabs defaultValue="root-cause">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="root-cause">
          <ShieldAlert className="w-3.5 h-3.5" />
          Root Cause
        </TabsTrigger>
        <TabsTrigger value="recommendations">
          <Lightbulb className="w-3.5 h-3.5" />
          Recommendations
        </TabsTrigger>
        <TabsTrigger value="raw-data">
          <FileCode2 className="w-3.5 h-3.5" />
          Raw Data
        </TabsTrigger>
      </TabsList>

      {/* ─── Root Cause Tab ───────────────────────────────────────────── */}
      <TabsContent value="root-cause">
        {analysis ? (
          <div className="space-y-5">
            {/* Primary cause */}
            <div
              className="p-5 rounded-xl border"
              style={{
                background: 'rgba(245,158,11,0.04)',
                borderColor: 'rgba(245,158,11,0.2)',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{CATEGORY_ICONS[analysis.rootCauseCategory] ?? '◎'}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded border"
                      style={{
                        color: 'var(--amber)',
                        borderColor: 'rgba(245,158,11,0.3)',
                        background: 'rgba(245,158,11,0.08)',
                      }}
                    >
                      {analysis.rootCauseCategory.toUpperCase()}
                    </span>
                    <div
                      className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded border"
                      style={{
                        color: analysis.confidenceScore >= 75 ? 'var(--ok)' : analysis.confidenceScore >= 50 ? 'var(--caution)' : 'var(--warn)',
                        borderColor: analysis.confidenceScore >= 75 ? 'rgba(0,255,163,0.3)' : 'rgba(252,211,77,0.3)',
                        background: analysis.confidenceScore >= 75 ? 'rgba(0,255,163,0.08)' : 'rgba(252,211,77,0.08)',
                      }}
                    >
                      <BarChart3 className="w-2.5 h-2.5" />
                      {analysis.confidenceScore}% confidence
                    </div>
                  </div>
                  <p className="text-sm text-ink-primary font-body leading-relaxed">
                    {analysis.primaryCause}
                  </p>
                </div>
              </div>
            </div>

            {/* Causal chain */}
            {analysis.causalChain.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-widest text-ink-muted">
                  Causal Chain
                </h4>
                <div className="space-y-2">
                  {analysis.causalChain.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border animate-slide-up-fade"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <span
                        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-700 border"
                        style={{
                          color: 'var(--amber)',
                          borderColor: 'rgba(245,158,11,0.3)',
                          background: 'rgba(245,158,11,0.08)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-sm text-ink-secondary leading-relaxed pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState message="Root cause analysis unavailable — the Root Cause Agent encountered an error." />
        )}
      </TabsContent>

      {/* ─── Recommendations Tab ──────────────────────────────────────── */}
      <TabsContent value="recommendations">
        {recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations
              .sort((a, b) => a.recommendationOrder - b.recommendationOrder)
              .map((rec, i) => {
                const pm = PRIORITY_META[rec.priority] ?? PRIORITY_META['Short-term']
                return (
                  <div
                    key={rec.recommendationOrder}
                    className="card-ops p-5 group animate-slide-up-fade"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-700 border"
                        style={{
                          color: pm.color,
                          borderColor: `${pm.color}40`,
                          background: pm.bg,
                        }}
                      >
                        {rec.recommendationOrder}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded border"
                            style={{ color: pm.color, borderColor: `${pm.color}40`, background: pm.bg }}
                          >
                            {rec.priority.toUpperCase()}
                          </span>
                          {rec.responsibleTeam && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-ink-muted">
                              {rec.responsibleTeam}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-ink-primary leading-snug mb-2">
                          {rec.action}
                        </p>

                        {rec.rationale && (
                          <p className="text-xs text-ink-muted font-mono leading-relaxed">
                            {rec.rationale}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        ) : (
          <EmptyState message="Recommendations unavailable — the Recommendation Agent encountered an error." />
        )}
      </TabsContent>

      {/* ─── Raw Data Tab ────────────────────────────────────────────── */}
      <TabsContent value="raw-data">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Logs */}
          <div className="lg:col-span-3 space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-widest text-ink-muted">
              Submitted Logs
            </h4>
            <div className="terminal-log max-h-[480px] overflow-y-auto">
              {rawLogs || '— No log content submitted —'}
            </div>
          </div>

          {/* Metrics */}
          <div className="lg:col-span-2 space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-widest text-ink-muted">
              System Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <MetricPill
                value={`${metrics.cpuUsagePercent.toFixed(1)}%`}
                label="CPU Usage"
                color={metrics.cpuUsagePercent > 90 ? '#FF2040' : metrics.cpuUsagePercent > 75 ? '#FB923C' : '#00FFA3'}
              />
              <MetricPill
                value={`${metrics.memoryUsagePercent.toFixed(1)}%`}
                label="Memory"
                color={metrics.memoryUsagePercent > 90 ? '#FF2040' : metrics.memoryUsagePercent > 75 ? '#FB923C' : '#00FFA3'}
              />
              <MetricPill
                value={`${metrics.errorRatePercent.toFixed(1)}%`}
                label="Error Rate"
                color={metrics.errorRatePercent > 10 ? '#FF2040' : metrics.errorRatePercent > 5 ? '#FB923C' : '#00FFA3'}
              />
              <MetricPill
                value={metrics.responseTimeMs > 1000
                  ? `${(metrics.responseTimeMs / 1000).toFixed(2)}s`
                  : `${metrics.responseTimeMs}ms`}
                label="Response Time"
                color={metrics.responseTimeMs > 5000 ? '#FF2040' : metrics.responseTimeMs > 2000 ? '#FB923C' : '#00FFA3'}
              />
            </div>

            <div className="mt-3 p-4 rounded-lg border border-border bg-elevated space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">Incident Details</p>
              <div className="space-y-1.5">
                {[
                  ['Submitted', formatDateTime(incident.createdAt)],
                  ['Resolved', formatDateTime(incident.resolvedAt)],
                  ['Environment', incident.environment.toUpperCase()],
                  ['Services', incident.affectedServices.length.toString()],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-xs font-mono">
                    <span className="text-ink-muted">{k}</span>
                    <span className="text-ink-secondary text-right truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}

function MetricPill({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="metric-pill">
      <span className="value" style={{ color }}>{value}</span>
      <span className="label">{label}</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center p-10 text-center rounded-xl border border-border">
      <p className="text-sm font-mono text-ink-muted leading-relaxed max-w-sm">{message}</p>
    </div>
  )
}
