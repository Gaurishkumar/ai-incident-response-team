'use client'

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitive.Provider
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[100vw]',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

type ToastVariant = 'default' | 'success' | 'error' | 'warning'

interface ToastProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: ToastVariant
  title?: string
  description?: string
}

const variantStyles: Record<ToastVariant, string> = {
  default: 'border-border bg-elevated text-ink-primary',
  success: 'border-ok/30 bg-ok/10 text-ok',
  error:   'border-alert/30 bg-alert/10 text-alert',
  warning: 'border-amber/30 bg-amber/10 text-amber',
}

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant = 'default', title, description, children, ...props }, ref) => (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-4 shadow-card',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
        'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        'data-[state=open]:animate-slide-right-fade data-[state=closed]:animate-fade-in',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">
        {title && (
          <ToastPrimitive.Title className="text-sm font-display font-700 mb-0.5">
            {title}
          </ToastPrimitive.Title>
        )}
        {description && (
          <ToastPrimitive.Description className="text-xs opacity-80">
            {description}
          </ToastPrimitive.Description>
        )}
        {children}
      </div>
      <ToastPrimitive.Close className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  ),
)
Toast.displayName = ToastPrimitive.Root.displayName

/* ─── useToast hook ──────────────────────────────────────────────────── */
type ToastEntry = ToastProps & { id: string; open: boolean }

let toastListeners: ((toasts: ToastEntry[]) => void)[] = []
let toastList: ToastEntry[] = []

function emitToasts() {
  toastListeners.forEach((fn) => fn([...toastList]))
}

export function toast(props: Omit<ToastProps, 'open'>) {
  const id = Math.random().toString(36).slice(2)
  toastList = [...toastList, { ...props, id, open: true }]
  emitToasts()
  setTimeout(() => {
    toastList = toastList.filter((t) => t.id !== id)
    emitToasts()
  }, 5000)
}

function Toaster() {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([])

  React.useEffect(() => {
    toastListeners.push(setToasts)
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== setToasts)
    }
  }, [])

  return (
    <ToastProvider>
      {toasts.map(({ id, open, ...props }) => (
        <Toast key={id} open={open} onOpenChange={(o) => { if (!o) { toastList = toastList.filter((t) => t.id !== id); emitToasts() } }} {...props} />
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

export { Toaster, Toast, ToastProvider, ToastViewport }
