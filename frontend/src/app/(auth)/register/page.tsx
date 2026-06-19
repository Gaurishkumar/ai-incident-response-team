'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ApiClientError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const schema = z.object({
  username: z.string().min(3, 'Min 3 characters').max(100, 'Max 100 characters'),
  email:    z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit'),
  role: z.enum(['DEVELOPER', 'ADMIN'] as const),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { role: 'DEVELOPER' },
  })

  const selectedRole = watch('role')

  async function onSubmit(data: FormData) {
    setGlobalError(null)
    try {
      await registerUser(data)
      setRegistered(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 400 && err.fields?.length) {
          setGlobalError(err.fields.map((f) => `${f.field}: ${f.message}`).join(' · '))
        } else if (err.status === 0) {
          setGlobalError(err.message)
        } else {
          setGlobalError(err.message ?? 'Registration failed. Please try again.')
        }
      } else {
        setGlobalError('An unexpected error occurred.')
      }
    }
  }

  if (registered) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: 'var(--bg-void)' }}>
        <div className="card-ops p-8 max-w-md w-full text-center animate-slide-up-fade">
          <CheckCircle2 className="w-12 h-12 text-ok mx-auto mb-4" />
          <h2 className="heading-section text-xl text-ink-primary mb-2">Account Created</h2>
          <p className="text-sm text-ink-secondary">Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-ops-grid flex items-center justify-center p-4" style={{ background: 'var(--bg-void)' }}>
      {/* Atmospheric orbs */}
      <div className="orb orb-cyan w-96 h-96 -top-20 -right-20 opacity-50 fixed" />
      <div className="orb orb-amber w-80 h-80 bottom-0 -left-10 opacity-40 fixed" />

      <div className="w-full max-w-md relative z-10 animate-slide-up-fade">
        <div
          className="h-px w-full rounded-t-xl"
          style={{ background: 'linear-gradient(90deg, transparent, var(--cyan), var(--amber), transparent)' }}
        />

        <div className="card-ops p-8 rounded-b-xl rounded-t-none">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="w-5 h-5 text-amber" strokeWidth={2.5} />
              <span className="text-brand text-sm text-amber tracking-[0.2em]">OPS COPILOT</span>
            </div>
            <h1 className="heading-hero text-3xl text-ink-primary mb-2">
              Create Account
            </h1>
            <p className="text-sm text-ink-secondary">
              Join the incident response team.
            </p>
          </div>

          {globalError && (
            <div className="mb-6 flex items-start gap-3 p-3 rounded-lg border border-alert/30 bg-alert/8">
              <AlertTriangle className="w-4 h-4 text-alert shrink-0 mt-0.5" />
              <p className="text-xs text-alert leading-relaxed">{globalError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="jdoe"
                  hasError={!!errors.username}
                  autoComplete="username"
                  {...register('username')}
                />
                {errors.username && <p className="text-xs text-alert">{errors.username.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="flex gap-2">
                  {(['DEVELOPER', 'ADMIN'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setValue('role', r, { shouldValidate: true })}
                      className="flex-1 py-2 rounded-lg text-xs font-mono font-medium border transition-all duration-200"
                      style={
                        selectedRole === r
                          ? { background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.4)', color: 'var(--amber)' }
                          : { background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--ink-muted)' }
                      }
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email address</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="engineer@company.com"
                hasError={!!errors.email}
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-alert">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Password</Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 chars, 1 uppercase, 1 digit"
                  hasError={!!errors.password}
                  autoComplete="new-password"
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
              {errors.password && <p className="text-xs text-alert">{errors.password.message}</p>}
            </div>

            <Button type="submit" size="lg" className="w-full mt-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Register
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-amber hover:text-amber-bright transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
