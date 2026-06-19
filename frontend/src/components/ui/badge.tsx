import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium transition-colors',
  {
    variants: {
      variant: {
        default:   'border-amber/40 bg-amber/10 text-amber',
        secondary: 'border-border text-ink-secondary bg-elevated',
        cyan:      'border-cyan/30 bg-cyan/10 text-cyan',
        ok:        'border-ok/30 bg-ok/10 text-ok',
        alert:     'border-alert/40 bg-alert/10 text-alert',
        warn:      'border-warn/40 bg-warn/10 text-warn',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
