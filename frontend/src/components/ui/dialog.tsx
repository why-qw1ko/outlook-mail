import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full animate-scale-in overflow-hidden rounded-2xl border border-border bg-card shadow-float',
          sizes[size],
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
            <div className="space-y-1">
              {title ? <h2 className="text-headline text-lg">{title}</h2> : null}
              {description ? <p className="text-paragraph text-[13px] leading-relaxed">{description}</p> : null}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="关闭">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="max-h-[min(70vh,640px)] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-accent/30 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
