import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Inbox, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { fetchPublicMessage, fetchPublicShare, syncPublicShare } from '@/lib/api'
import { formatRelativeTime, formatSender, formatTime } from '@/lib/format'
import type { MessageDetail, MessageItem, PublicSharePayload } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/primitives'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { MailHtmlFrame } from '@/components/common/MailHtmlFrame'
import { EmptyState, LoadingState } from '@/components/common/states'

export function PublicSharePage() {
  const { token = '' } = useParams()
  const [data, setData] = useState<PublicSharePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox')
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = useCallback(async () => {
    if (!token) {
      setError('分享链接无效')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await fetchPublicShare(token)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分享链接不可用')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const handleManualSync = async () => {
    if (!token || syncing) return
    setSyncing(true)
    setError('')
    try {
      const result = await syncPublicShare(token)
      setData(result)
      setSelectedMessage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取邮件失败')
    } finally {
      setSyncing(false)
    }
  }

  const openMessage = async (message: MessageItem) => {
    if (!token) return
    setLoadingDetail(true)
    setError('')
    try {
      const detail = await fetchPublicMessage(token, message.id)
      setSelectedMessage(detail)
    } catch {
      setError('无法打开该邮件')
    } finally {
      setLoadingDetail(false)
    }
  }

  if (loading) {
    return (
      <div className="app-canvas flex min-h-screen items-center justify-center">
        <LoadingState label="加载分享内容…" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="app-canvas flex min-h-screen items-center justify-center px-4">
        <div className="surface max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-headline text-xl">无法访问该分享</h1>
          <p className="text-paragraph mt-3 text-sm leading-relaxed">{error}</p>
          <Button className="mt-5" variant="outline" onClick={() => void load()}>
            重试
          </Button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const messages = folder === 'inbox' ? data.inbox : data.sent

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <header className="glass-bar border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <Inbox className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-headline truncate text-base">{data.account.email}</p>
            <p className="text-paragraph text-xs">
              只读分享 · 有效期至 {formatTime(data.expires_at)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" onClick={handleManualSync} loading={syncing} disabled={syncing}>
              <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
              {syncing ? '获取中…' : '获取邮件'}
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="mx-auto mt-4 w-full max-w-6xl px-5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mx-auto grid w-full max-w-6xl min-h-0 flex-1 gap-4 p-5 lg:grid-cols-[340px_1fr]">
        <section className="surface flex min-h-[420px] flex-col overflow-hidden">
          <div className="grid grid-cols-2 gap-1 border-b border-border/70 p-3">
            {(
              [
                { value: 'inbox', label: `收件箱 (${data.inbox.length})` },
                { value: 'sent', label: `已发送 (${data.sent.length})` },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setFolder(item.value)
                  setSelectedMessage(null)
                }}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  folder === item.value
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="scroll-area min-h-0 flex-1 p-2">
            {messages.length === 0 ? (
              <EmptyState title="暂无邮件" description="点击右上角「获取邮件」手动同步" />
            ) : (
              <div className="space-y-1.5">
                {messages.map((message) => {
                  const active = selectedMessage?.id === message.id
                  return (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => void openMessage(message)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-all',
                        active
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-transparent hover:border-border hover:bg-accent/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {message.subject || '(无主题)'}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatRelativeTime(message.sent_at)}
                        </span>
                      </div>
                      <p className="text-paragraph mt-1 truncate text-xs">
                        {folder === 'sent'
                          ? message.recipient_summary
                          : formatSender(message.sender_name, message.sender_email)}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="surface overflow-hidden">
          {loadingDetail ? (
            <LoadingState label="打开邮件…" />
          ) : selectedMessage ? (
            <div className="scroll-area h-full">
              <div className="border-b border-border/70 px-6 py-5">
                <h2 className="text-headline text-xl leading-snug">
                  {selectedMessage.subject || '(无主题)'}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge tone="primary">{folder === 'sent' ? '发件' : '收件'}</Badge>
                  <span>
                    {folder === 'sent'
                      ? `收件人 ${selectedMessage.recipient_summary}`
                      : formatSender(selectedMessage.sender_name, selectedMessage.sender_email)}
                  </span>
                  <span>·</span>
                  <span>{formatTime(selectedMessage.sent_at)}</span>
                </div>
              </div>
              <div className="px-6 py-5">
                {selectedMessage.body_html?.trim() ? (
                  <MailHtmlFrame html={selectedMessage.body_html} />
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                    {selectedMessage.body_text || selectedMessage.preview || '(空正文)'}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="选择一封邮件"
              description="此页面为只读分享，可手动获取最新邮件"
            />
          )}
        </section>
      </div>
    </div>
  )
}
