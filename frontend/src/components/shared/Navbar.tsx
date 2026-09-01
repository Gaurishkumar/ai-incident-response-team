'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertTriangle, LayoutDashboard, LogOut, Plus, ShieldCheck, User, UserCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const BASE_NAV_LINKS = [
  { href: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/incidents/new',   label: 'New Incident',   icon: Plus },
]

export function Navbar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const navLinks = [
    ...BASE_NAV_LINKS,
    ...(user?.role === 'SUPER_ADMIN'
      ? [{ href: '/admin/organizations', label: 'Org Approvals', icon: ShieldCheck }]
      : []),
    ...(user?.role === 'ORG_ADMIN'
      ? [{ href: '/org-admin/join-requests', label: 'Join Requests', icon: UserCheck }]
      : []),
  ]

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    setLoggingOut(false)
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-base/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-8">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative flex items-center justify-center w-7 h-7">
              <AlertTriangle
                className="w-5 h-5 text-amber group-hover:text-amber-bright transition-colors"
                strokeWidth={2.5}
              />
              <span
                className="absolute inset-0 rounded-sm opacity-20 group-hover:opacity-40 transition-opacity"
                style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.6) 0%, transparent 70%)' }}
              />
            </div>
            <span className="text-brand text-sm text-amber tracking-[0.18em] leading-none">
              OPS COPILOT
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-600 uppercase tracking-wider transition-all duration-200',
                    active
                      ? 'text-amber bg-amber/10 border border-amber/20'
                      : 'text-ink-muted hover:text-ink-secondary hover:bg-hover-bg border border-transparent',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-elevated">
                <User className="w-3.5 h-3.5 text-ink-muted" />
                <span className="text-xs font-mono text-ink-secondary">{user.username}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
                  style={{
                    color: user.role === 'ADMIN' ? '#22D3EE' : '#8892AA',
                    background: user.role === 'ADMIN' ? 'rgba(34,211,238,0.1)' : 'transparent',
                  }}
                >
                  {user.role}
                </span>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="gap-1.5 text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
