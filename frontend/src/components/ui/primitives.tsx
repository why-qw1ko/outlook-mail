import { forwardRef, type HTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-[13px] font-medium text-foreground/90 leading-none', className)}
      {...props}
    />
  )
}

export function Badge({
  className,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'default' | 'primary' | 'secondary' | 'destructive' | 'success' | 'outline'
}) {
  const tones = {
    default: 'bg-muted/15 text-muted-foreground',
    primary: 'bg-primary/15 text-primary',
    secondary: 'bg-secondary/25 text-secondary-foreground',
    destructive: 'bg-destructive/15 text-destructive',
    success: 'bg-emerald-500/15 text-emerald-700',
    outline: 'border border-border text-muted-foreground',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-sm text-foreground shadow-soft transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
)
Select.displayName = 'Select'

export function Separator({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  return (
    <div
      className={cn(vertical ? 'w-px self-stretch bg-border' : 'h-px w-full bg-border', className)}
    />
  )
}

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('surface p-4', className)} {...props} />
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-headline text-base', className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-paragraph text-[13px] leading-relaxed', className)} {...props} />
}
