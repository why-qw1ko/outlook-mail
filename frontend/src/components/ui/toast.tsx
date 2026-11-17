import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++
      setItems((current) => [...current, { id, kind, message }])
      const duration = kind === 'error' ? Math.min(18000, Math.max(8000, message.length * 100)) : 3600
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(400px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-h-[40dvh] items-start gap-3 overflow-y-auto rounded-lg border border-border bg-card px-4 py-3 shadow-panel animate-fade-in',
            )}
          >
            {item.kind === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
            {item.kind === 'error' && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
            {item.kind === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            <p className="min-w-0 flex-1 break-words text-sm leading-5 text-foreground">{item.message}</p>
            <button
              type="button"
              className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => dismiss(item.id)}
              aria-label="关闭提示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
