'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, AlertTriangle, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ApiClientError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [isRateLimited, setIsRateLimited] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onBlur' })

  async function onSubmit(data: FormData) {
    setGlobalError(null)
    setIsRateLimited(false)
    try {
      await login(data)
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          setGlobalError('Invalid email or password. Please try again.')
        } else if (err.status === 423) {
          setGlobalError('Your account is not active yet or has been deactivated.')
        } else if (err.status === 429) {
          setIsRateLimited(true)
        } else if (err.status === 0) {
          setGlobalError(err.message)
        } else {
          setGlobalError('Something went wrong on our end. Please try again.')
        }
      } else {
        setGlobalError('An unexpected error occurred.')
      }
    }
  }

  return (
    <div className="min-h-dvh bg-ops-grid flex items-center justify-center p-4" style={{ background: 'var(--bg-void)' }}>
      {/* Atmospheric orbs */}
      <div className="orb orb-amber w-96 h-96 -top-20 -left-20 opacity-60 fixed" />
      <div className="orb orb-cyan w-80 h-80 -bottom-10 -right-10 opacity-40 fixed" />

      {/* Card */}
      <div className="w-full max-w-md relative z-10 animate-slide-up-fade">
        {/* Top accent bar */}
        <div
          className="h-px w-full rounded-t-xl"
          style={{ background: 'linear-gradient(90deg, transparent, var(--amber), var(--cyan), transparent)' }}
        />

        <div className="card-ops p-8 rounded-b-xl rounded-t-none">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="w-5 h-5 text-amber" strokeWidth={2.5} />
              <span className="text-brand text-sm text-amber tracking-[0.2em]">OPS COPILOT</span>
            </div>
            <h1 className="heading-hero text-3xl text-ink-primary mb-2">
              System Access
            </h1>
            <p className="text-sm text-ink-secondary leading-relaxed">
              Authenticate to access the incident response dashboard.
            </p>
          </div>

          {/* Rate limit banner */}
          {isRateLimited && (
            <div className="mb-6 flex items-start gap-3 p-3 rounded-lg border border-amber/30 bg-amber/8">
              <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
              <p className="text-xs text-amber leading-relaxed">
                Too many login attempts — please wait a moment before trying again.
              </p>
            </div>
          )}

          {/* Global error */}
          {globalError && (
            <div className="mb-6 flex items-start gap-3 p-3 rounded-lg border border-alert/30 bg-alert/8">
              <AlertTriangle className="w-4 h-4 text-alert shrink-0 mt-0.5" />
              <p className="text-xs text-alert leading-relaxed">{globalError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="engineer@company.com"
                hasError={!!errors.email}
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-alert mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  hasError={!!errors.password}
                  autoComplete="current-password"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-alert mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  Access System
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-muted">
            No account?{' '}
            <Link
              href="/register"
              className="text-amber hover:text-amber-bright transition-colors font-medium"
            >
              Register here
            </Link>
          </p>
        </div>

        {/* Decorative bottom line */}
        <div className="mt-4 flex items-center gap-2 justify-center">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-widest px-2">Incident Response v1.0</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </div>
    </div>
  )
}
