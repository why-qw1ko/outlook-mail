import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-soft transition-colors placeholder:text-muted-foreground/70 focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-soft transition-colors placeholder:text-muted-foreground/70 focus-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
