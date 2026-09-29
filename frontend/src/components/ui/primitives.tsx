import { forwardRef, type HTMLAttributes, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge as ShadcnBadge } from './badge'
import { cn } from '@/lib/utils'

export { Label } from './label'
export { Separator } from './separator'
export { Card, CardHeader, CardTitle, CardDescription } from './card'

export function Badge({
  className,
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: 'default' | 'primary' | 'secondary' | 'destructive' | 'success' | 'outline'
}) {
  const tones = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/15 text-foreground',
    secondary: 'bg-secondary/10 text-secondary',
    destructive: 'bg-destructive/15 text-destructive',
    success: 'bg-success-surface text-success',
    outline: 'border border-border text-muted-foreground',
  }
  return (
    <ShadcnBadge variant="outline"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border-transparent px-2 py-0.5 text-[11px] font-medium shadow-none',
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
          'h-10 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-9 text-sm text-foreground shadow-sm transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/40',
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
