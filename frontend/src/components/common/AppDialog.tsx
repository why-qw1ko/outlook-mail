import { useRef, type ReactNode } from 'react'
import { Dialog as DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' }

// Keep business dialogs concise while using shadcn/Radix for modal behavior.
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: keyof typeof sizes
}) {
  const previousFocus = useRef<HTMLElement | null>(null)
  return (
    <DialogRoot open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent
        className={cn('flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0', sizes[size])}
        {...(!description ? { 'aria-describedby': undefined } : {})}
        onOpenAutoFocus={() => {
          const active = document.activeElement as HTMLElement | null
          // Menu items unmount when selected; return to their persistent trigger.
          const menuTrigger = active?.closest('[role="menu"]')?.getAttribute('aria-labelledby')
          previousFocus.current = (menuTrigger ? document.getElementById(menuTrigger) : null) ?? active
        }}
        onCloseAutoFocus={(event) => {
          // These controlled dialogs have triggers outside the Radix root.
          event.preventDefault()
          previousFocus.current?.focus()
        }}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12 text-left">
          <DialogTitle>{title || '操作确认'}</DialogTitle>
          {description ? <DialogDescription className="leading-relaxed">{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <DialogFooter className="shrink-0 flex-row flex-wrap gap-2 border-t bg-muted/50 px-6 py-4 sm:space-x-0">{footer}</DialogFooter> : null}
      </DialogContent>
    </DialogRoot>
  )
}
