'use client'

import { useState, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertTriangle, ArrowRight, Cpu, HardDrive, Loader2,
  MemoryStick, Plus, Server, Timer, X, Zap,
} from 'lucide-react'
import { api, ApiClientError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/shared/ErrorBanner'

const schema = z.object({
  incident_title: z
    .string()
    .min(10, 'Min 10 characters')
    .max(120, 'Max 120 characters'),
  description: z
    .string()
    .min(50, 'Min 50 characters')
    .max(2000, 'Max 2000 characters'),
  environment: z.enum(['production', 'staging', 'development'] as const, {
    errorMap: () => ({ message: 'Select an environment' }),
  }),
  severity: z.enum(['P1', 'P2', 'P3', 'P4'] as const, {
    errorMap: () => ({ message: 'Select a severity level' }),
  }),
  affected_services: z
    .array(z.string().max(50))
    .min(1, 'Add at least one service')
    .max(20, 'Max 20 services'),
  raw_logs: z
    .string()
    .min(50, 'Min 50 characters')
    .max(5000, 'Max 5000 characters'),
  cpu_usage_percent: z
    .number({ invalid_type_error: 'Required' })
    .min(0).max(100),
  memory_usage_percent: z
    .number({ invalid_type_error: 'Required' })
    .min(0).max(100),
  error_rate_percent: z
    .number({ invalid_type_error: 'Required' })
    .min(0).max(100),
  response_time_ms: z
    .number({ invalid_type_error: 'Required' })
    .int()
    .min(1)
    .max(60000),
})

type FormData = z.infer<typeof schema>

const SEVERITY_OPTS = [
  { value: 'P1', label: 'P1 CRITICAL', color: '#FF2040', bg: 'rgba(255,32,64,0.1)', border: 'rgba(255,32,64,0.4)' },
  { value: 'P2', label: 'P2 HIGH',     color: '#FB923C', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.4)' },
  { value: 'P3', label: 'P3 MEDIUM',   color: '#FCD34D', bg: 'rgba(252,211,77,0.1)', border: 'rgba(252,211,77,0.4)' },
  { value: 'P4', label: 'P4 LOW',      color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.4)' },
] as const

const ENV_OPTS = [
  { value: 'production',  label: 'Production',  color: '#FF2040' },
  { value: 'staging',     label: 'Staging',     color: '#F59E0B' },
  { value: 'development', label: 'Development', color: '#60A5FA' },
] as const

export function SubmissionForm() {
  const router = useRouter()
  const [tagInput, setTagInput] = useState('')
  const [submitError, setSubmitError] = useState<{ code: string; message: string } | null>(null)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { affected_services: [] },
  })

  const watchedServices = watch('affected_services') ?? []
  const watchedSeverity = watch('severity')
  const watchedEnv = watch('environment')

  function addTag() {
    const tag = tagInput.trim().replace(/[^a-zA-Z0-9\-]/g, '')
    if (!tag || watchedServices.includes(tag) || watchedServices.length >= 20) return
    setValue('affected_services', [...watchedServices, tag], { shouldValidate: true })
    setTagInput('')
  }

  function removeTag(tag: string) {
    setValue(
      'affected_services',
      watchedServices.filter((s) => s !== tag),
      { shouldValidate: true },
    )
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !tagInput && watchedServices.length > 0) {
      removeTag(watchedServices[watchedServices.length - 1])
    }
  }

  async function onSubmit(data: FormData) {
    setSubmitError(null)
    try {
      const result = await api.incidents.create({
        incident_title: data.incident_title,
        description: data.description,
        environment: data.environment,
        severity: data.severity,
        affected_services: data.affected_services,
        raw_logs: data.raw_logs,
        metrics: {
          cpu_usage_percent: data.cpu_usage_percent,
          memory_usage_percent: data.memory_usage_percent,
          error_rate_percent: data.error_rate_percent,
          response_time_ms: data.response_time_ms,
        },
      })
      router.push(`/incidents/${result.id}`)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSubmitError({ code: err.code, message: err.message })
      } else {
        setSubmitError({ code: 'UNKNOWN', message: 'Failed to submit incident.' })
      }
    }
  }

  const descCount = (watch('description') ?? '').length
  const logsCount = (watch('raw_logs') ?? '').length

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      {submitError && (
        <ErrorBanner
          code={submitError.code}
          message={submitError.message}
          onDismiss={() => setSubmitError(null)}
          onRetry={() => handleSubmit(onSubmit)()}
        />
      )}

      {/* ─── Identity ────────────────────────────────────────────────── */}
      <section className="card-ops p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-medium uppercase tracking-widest text-amber">01</span>
          <h2 className="font-display font-700 text-base text-ink-primary">Incident Identity</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-1.5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="incident_title">Incident Title *</Label>
              <span className="text-[10px] font-mono text-ink-muted">
                {(watch('incident_title') ?? '').length}/120
              </span>
            </div>
            <Input
              id="incident_title"
              placeholder="e.g. Payment service throwing 500s after deploy"
              hasError={!!errors.incident_title}
              {...register('incident_title')}
            />
            {errors.incident_title && <p className="text-xs text-alert">{errors.incident_title.message}</p>}
          </div>

          {/* Severity segmented radio */}
          <div className="space-y-1.5">
            <Label>Severity Level *</Label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITY_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue('severity', opt.value, { shouldValidate: true })}
                  className="py-2 rounded-lg text-xs font-mono font-medium border transition-all duration-200"
                  style={
                    watchedSeverity === opt.value
                      ? { color: opt.color, background: opt.bg, borderColor: opt.border }
                      : { color: 'var(--ink-muted)', background: 'var(--bg-elevated)', borderColor: 'var(--border)' }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.severity && <p className="text-xs text-alert">{errors.severity.message}</p>}
          </div>

          {/* Environment */}
          <div className="space-y-1.5">
            <Label>Environment *</Label>
            <div className="grid grid-cols-3 gap-2">
              {ENV_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue('environment', opt.value, { shouldValidate: true })}
                  className="py-2 rounded-lg text-xs font-mono font-medium border transition-all duration-200"
                  style={
                    watchedEnv === opt.value
                      ? { color: opt.color, background: `${opt.color}14`, borderColor: `${opt.color}50` }
                      : { color: 'var(--ink-muted)', background: 'var(--bg-elevated)', borderColor: 'var(--border)' }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.environment && <p className="text-xs text-alert">{errors.environment.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Description *</Label>
            <span className={`text-[10px] font-mono ${descCount > 1800 ? 'text-warn' : 'text-ink-muted'}`}>
              {descCount}/2000
            </span>
          </div>
          <Textarea
            id="description"
            placeholder="Describe what is failing, what you've observed, and when it started. Be specific."
            hasError={!!errors.description}
            rows={4}
            {...register('description')}
          />
          {errors.description && <p className="text-xs text-alert">{errors.description.message}</p>}
        </div>
      </section>

      {/* ─── Affected Services ───────────────────────────────────────── */}
      <section className="card-ops p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-medium uppercase tracking-widest text-amber">02</span>
          <h2 className="font-display font-700 text-base text-ink-primary">Affected Services</h2>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tag-input">
            Services * <span className="text-ink-muted normal-case">(press Enter or comma to add)</span>
          </Label>

          <div
            className={`input-ops flex flex-wrap gap-2 p-2.5 min-h-[44px] cursor-text ${errors.affected_services ? 'error' : ''}`}
            onClick={() => document.getElementById('tag-input')?.focus()}
          >
            {watchedServices.map((s) => (
              <span key={s} className="tag">
                <Server className="w-2.5 h-2.5" />
                {s}
                <button type="button" onClick={() => removeTag(s)}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <input
              id="tag-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { if (tagInput.trim()) addTag() }}
              placeholder={watchedServices.length === 0 ? 'api-gateway, payment-service, redis-cache…' : ''}
              className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-ink-primary placeholder:text-ink-muted font-mono"
              disabled={watchedServices.length >= 20}
            />
            {tagInput && (
              <button
                type="button"
                onClick={addTag}
                className="text-cyan hover:text-cyan-bright transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {errors.affected_services && (
            <p className="text-xs text-alert">{errors.affected_services.message}</p>
          )}
          <p className="text-[11px] text-ink-muted font-mono">
            {watchedServices.length}/20 services · Alphanumeric and hyphens only
          </p>
        </div>
      </section>

      {/* ─── Log Content ─────────────────────────────────────────────── */}
      <section className="card-ops p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-medium uppercase tracking-widest text-amber">03</span>
          <h2 className="font-display font-700 text-base text-ink-primary">Log Content</h2>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="raw_logs">Raw Logs *</Label>
            <span className={`text-[10px] font-mono ${logsCount > 4500 ? 'text-warn' : 'text-ink-muted'}`}>
              {logsCount}/5000
            </span>
          </div>
          <Textarea
            id="raw_logs"
            mono
            hasError={!!errors.raw_logs}
            rows={12}
            placeholder={`[2026-06-18 14:32:01] ERROR PaymentService - Connection refused: redis:6379
[2026-06-18 14:32:01] ERROR PaymentService - java.net.ConnectException: Connection refused
[2026-06-18 14:32:02] ERROR PaymentService - Retry attempt 1/3 failed
...`}
            {...register('raw_logs')}
          />
          {errors.raw_logs && <p className="text-xs text-alert">{errors.raw_logs.message}</p>}
          <p className="text-[11px] text-ink-muted font-mono">
            Paste exception stack traces, error logs, and relevant system output. The AI will extract patterns automatically.
          </p>
        </div>
      </section>

      {/* ─── System Metrics ──────────────────────────────────────────── */}
      <section className="card-ops p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-medium uppercase tracking-widest text-amber">04</span>
          <h2 className="font-display font-700 text-base text-ink-primary">System Metrics</h2>
          <span className="text-xs text-ink-muted font-mono">(at time of incident)</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cpu">
              <Cpu className="w-3 h-3 inline mr-1" />
              CPU Usage %
            </Label>
            <Input
              id="cpu"
              type="number"
              min={0}
              max={100}
              step="0.1"
              placeholder="0–100"
              hasError={!!errors.cpu_usage_percent}
              {...register('cpu_usage_percent', { valueAsNumber: true })}
            />
            {errors.cpu_usage_percent && (
              <p className="text-[11px] text-alert">{errors.cpu_usage_percent.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="memory">
              <MemoryStick className="w-3 h-3 inline mr-1" />
              Memory Usage %
            </Label>
            <Input
              id="memory"
              type="number"
              min={0}
              max={100}
              step="0.1"
              placeholder="0–100"
              hasError={!!errors.memory_usage_percent}
              {...register('memory_usage_percent', { valueAsNumber: true })}
            />
            {errors.memory_usage_percent && (
              <p className="text-[11px] text-alert">{errors.memory_usage_percent.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="error_rate">
              <Zap className="w-3 h-3 inline mr-1" />
              Error Rate %
            </Label>
            <Input
              id="error_rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
              placeholder="0–100"
              hasError={!!errors.error_rate_percent}
              {...register('error_rate_percent', { valueAsNumber: true })}
            />
            {errors.error_rate_percent && (
              <p className="text-[11px] text-alert">{errors.error_rate_percent.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="response_time">
              <Timer className="w-3 h-3 inline mr-1" />
              Response Time ms
            </Label>
            <Input
              id="response_time"
              type="number"
              min={1}
              max={60000}
              placeholder="1–60000"
              hasError={!!errors.response_time_ms}
              {...register('response_time_ms', { valueAsNumber: true })}
            />
            {errors.response_time_ms && (
              <p className="text-[11px] text-alert">{errors.response_time_ms.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* ─── Submit ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs font-mono text-ink-muted">
          All fields are required · Analysis takes 60–120 seconds
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              Launch Analysis
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
