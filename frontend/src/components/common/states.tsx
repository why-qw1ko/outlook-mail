import type { ReactNode } from 'react'
import { Inbox, Loader2, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 py-8 text-center',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-secondary">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div className="space-y-1.5">
        <p className="text-headline text-sm">{title}</p>
        {description ? (
          <p className="text-paragraph mx-auto max-w-sm text-xs leading-5">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function LoadingState({ label = '加载中…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex h-full min-h-[180px] flex-col items-center justify-center gap-3 text-muted-foreground', className)}>
      <Loader2 className="h-5 w-5 animate-spin text-secondary" />
      <p className="text-xs">{label}</p>
    </div>
  )
}

export function SearchEmpty({ keyword }: { keyword?: string }) {
  return (
    <EmptyState
      icon={<SearchX className="h-6 w-6" />}
      title="没有匹配结果"
      description={keyword ? `未找到与「${keyword}」相关的内容` : '试试调整筛选条件'}
    />
  )
}
