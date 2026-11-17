import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Dialog } from '@/components/common/AppDialog'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  destructive?: boolean
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((confirmed: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmOptions) => {
    if (resolver.current) return Promise.resolve(false)
    setOptions(next)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const finish = (confirmed: boolean) => {
    const resolve = resolver.current
    resolver.current = null
    setOptions(null)
    resolve?.(confirmed)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(options)} onClose={() => finish(false)} title={options?.title}
        description={options?.description} descriptionClassName="sr-only" size="sm"
        footer={<>
          <Button variant="outline" onClick={() => finish(false)}>取消</Button>
          <Button variant={options?.destructive ? 'destructive' : 'default'} onClick={() => finish(true)}>
            {options?.confirmText || '确认'}
          </Button>
        </>}>
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive"><AlertTriangle className="h-4 w-4" /></span>
          <p className="min-w-0 break-words pt-1 text-sm leading-5 text-foreground">{options?.description}</p>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider')
  return confirm
}
