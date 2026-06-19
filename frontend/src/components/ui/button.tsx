import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-amber text-black font-display font-bold tracking-wider uppercase hover:bg-amber-bright hover:shadow-amber-glow-sm',
        ghost:
          'bg-transparent text-ink-secondary border border-border hover:text-ink-primary hover:border-border-bright hover:bg-hover-bg',
        outline:
          'bg-transparent text-amber border border-amber/30 hover:bg-amber/10 hover:border-amber/60',
        destructive:
          'bg-alert/10 text-alert border border-alert/30 hover:bg-alert/20 hover:shadow-alert-glow',
        secondary:
          'bg-elevated text-ink-primary border border-border hover:border-border-bright hover:bg-hover-bg',
        link: 'text-amber underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm:      'h-8 px-3 text-xs',
        lg:      'h-12 px-7 text-base',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
