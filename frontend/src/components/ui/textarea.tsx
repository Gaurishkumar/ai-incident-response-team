import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
  mono?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, mono, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'input-ops flex w-full px-3 py-2 text-sm min-h-[100px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          mono && 'textarea-ops',
          hasError && 'error',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
