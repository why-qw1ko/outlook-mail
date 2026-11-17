import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MailPlus,
  MoreHorizontal,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react'
import {
  consumeAccount,
  fetchAccountDetail,
  fetchAccounts,
  fetchMessageDetail,
  fetchMessages,
  fetchPoolSummary,
  fetchSites,
  releaseAccount,
  sendMail,
  syncAccount,
  updateAccount,
} from '@/lib/api'
import { copyText, formatRelativeTime, formatSender, formatTime } from '@/lib/format'
import type {
  AccountDetail,
  AccountItem,
  AccountScope,
  MessageDetail,
  MessageFolder,
  MessageItem,
  SiteItem,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MailHtmlFrame } from '@/components/common/MailHtmlFrame'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge, Label, Select } from '@/components/ui/primitives'
import { Dialog } from '@/components/common/AppDialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, LoadingState, SearchEmpty } from '@/components/common/states'

const PAGE_SIZE = 50

export function StationPage() {
  const toast = useToast()

  const [mobilePane, setMobilePane] = useState<'accounts' | 'messages' | 'detail'>('accounts')
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const searchTimer = useRef<number | null>(null)
  const [scope, setScope] = useState<AccountScope>('all')
  const [batchCode, setBatchCode] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [sites, setSites] = useState<SiteItem[]>([])
  const [pool, setPool] = useState<{ pool_count: number; consumed_count: number } | null>(null)

  const [selected, setSelected] = useState<AccountDetail | null>(null)
  const [folder, setFolder] = useState<MessageFolder>('inbox')
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  const [composeOpen, setComposeOpen] = useState(false)
  const [siteActionOpen, setSiteActionOpen] = useState<'consume' | 'release' | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const result = await fetchAccounts({
        page,
        pageSize: PAGE_SIZE,
        keyword: searchKeyword,
        scope,
        batchCode,
        siteCode,
        stationOnly: true,
      })
      setAccounts(result.items)
      setTotal(result.total)
      setTotalPages(result.total_pages)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载邮箱列表失败')
    } finally {
      setLoadingAccounts(false)
    }
  }, [page, scope, batchCode, siteCode, searchKeyword, toast])

  const loadMeta = useCallback(async () => {
    try {
      const [siteResult, poolResult] = await Promise.all([
        fetchSites(),
        fetchPoolSummary(),
      ])
      setSites(siteResult.items.filter((item) => item.enabled))
      setPool({ pool_count: poolResult.pool_count, consumed_count: poolResult.consumed_count })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载基础数据失败')
    }
  }, [toast])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current)
    }
  }, [])

  const loadMessages = useCallback(
    async (accountId: number, nextFolder: MessageFolder) => {
      setLoadingMessages(true)
      setSelectedMessage(null)
      try {
        const items = await fetchMessages(accountId, nextFolder)
        setMessages(items)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '加载邮件失败')
      } finally {
        setLoadingMessages(false)
      }
    },
    [toast],
  )

  const selectAccount = useCallback(
    async (account: AccountItem) => {
      try {
        const detail = await fetchAccountDetail(account.id)
        setSelected(detail)
        setFolder('inbox')
        await loadMessages(account.id, 'inbox')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '打开邮箱失败')
      }
    },
    [loadMessages, toast],
  )

  const refreshSelectedAccount = useCallback(async () => {
    if (!selected) return
    try {
      const detail = await fetchAccountDetail(selected.id)
      setSelected(detail)
    } catch {
      // ignore soft refresh failures
    }
  }, [selected])

  /** 手动获取邮件：不使用倒计时轮询，由卡片或详情区快捷按钮显式触发。 */
  const handleSyncAccount = useCallback(
    async (accountId: number) => {
      if (syncingId !== null) return
      setSyncingId(accountId)
      try {
        const result = await syncAccount(accountId)
        const isCurrent = selected?.id === accountId
        await Promise.all([
          loadAccounts(),
          isCurrent ? refreshSelectedAccount() : Promise.resolve(),
          isCurrent ? loadMessages(accountId, folder) : Promise.resolve(),
        ])
        toast.success(
          `已获取邮件 · 收件 ${result.inbox_count} 封 / 发件 ${result.sent_count} 封`,
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '获取邮件失败')
      } finally {
        setSyncingId(null)
      }
    },
    [syncingId, selected?.id, folder, refreshSelectedAccount, loadMessages, loadAccounts, toast],
  )

  const openMessage = useCallback(async (message: MessageItem) => {
    if (!selected) return
    setLoadingDetail(true)
    try {
      const detail = await fetchMessageDetail(selected.id, message.id)
      setSelectedMessage(detail)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '打开邮件失败')
    } finally {
      setLoadingDetail(false)
    }
  }, [selected, toast])

  return (
    <div className="page-layout">
      {/* Top toolbar */}
      <header className="page-header">
        <div className="min-w-0">
          <h1 className="text-headline text-lg leading-tight">邮箱站</h1>
          <p className="text-paragraph text-xs">
            共 {total} 个邮箱
            {pool ? ` · 业务池内 ${pool.pool_count} · 业务使用中 ${pool.consumed_count}` : ''}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <div className="relative w-full sm:w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索邮箱"
              value={keyword}
              onChange={(e) => {
                const value = e.target.value
                setKeyword(value)
                if (searchTimer.current) window.clearTimeout(searchTimer.current)
                searchTimer.current = window.setTimeout(() => {
                  setPage(1)
                  setSearchKeyword(value.trim())
                }, 300)
              }}
            />
          </div>
          <Button size="sm" onClick={() => setComposeOpen(true)} disabled={!selected}>
            <MailPlus className="h-4 w-4" />
            写信
          </Button>
        </div>
      </header>

      <div className="flex shrink-0 gap-1 border-b bg-muted/40 p-2 xl:hidden" aria-label="邮件工作台分栏">
        {([{ value: 'accounts', label: '邮箱列表' }, { value: 'messages', label: '邮件列表' }, { value: 'detail', label: '阅读与详情' }] as const).map((pane) => (
          <Button key={pane.value} variant={mobilePane === pane.value ? 'secondary' : 'ghost'} size="sm" className="flex-1" aria-pressed={mobilePane === pane.value} onClick={() => setMobilePane(pane.value)}>{pane.label}</Button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Account list */}
        <section className={cn('min-h-0 w-full shrink-0 flex-col border-r border-border bg-card xl:flex xl:w-[260px] 2xl:w-[290px]', mobilePane === 'accounts' ? 'flex' : 'hidden')}>
          <div className="space-y-2 border-b border-border/70 px-3 py-3">
            <div className="grid grid-cols-3 gap-1 rounded-md bg-accent/60 p-1">
              {(
                [
                  { value: 'all', label: '全部' },
                  { value: 'pool', label: '池内' },
                  { value: 'consumed', label: '占用' },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setScope(item.value)
                    setPage(1)
                  }}
                  className={cn(
                    'focus-ring rounded-sm px-2 py-1 text-xs font-medium transition-colors',
                    scope === item.value
                      ? 'bg-card text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                className="h-8 text-xs"
                value={siteCode}
                onChange={(e) => {
                  setSiteCode(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">全部站点</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.code}>
                    {site.code}
                  </option>
                ))}
              </Select>
              <Input
                className="h-8 text-xs"
                placeholder="批次筛选"
                value={batchCode}
                onChange={(e) => {
                  setBatchCode(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          <div className="scroll-area min-h-0 flex-1 p-2">
            {loadingAccounts && accounts.length === 0 ? (
              <LoadingState label="加载邮箱…" />
            ) : accounts.length === 0 ? (
              keyword ? (
                <SearchEmpty keyword={keyword} />
              ) : (
                <EmptyState title="暂无邮箱" description="请在邮箱管理中导入邮箱并打开邮箱站开关" />
              )
            ) : (
              <div className="space-y-1.5">
                {accounts.map((account) => {
                  const active = selected?.id === account.id
                  const syncingThis = syncingId === account.id
                  return (
                    <div
                      key={account.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { void selectAccount(account); setMobilePane('messages') }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void selectAccount(account); setMobilePane('messages')
                        }
                      }}
                      className={cn(
                        'focus-ring w-full cursor-pointer rounded-md border px-3 py-3 text-left transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-transparent bg-card hover:border-border hover:bg-accent/40',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {account.is_pinned ? <Pin className="h-3 w-3 shrink-0 text-primary" /> : null}
                            <p className="truncate text-sm font-medium text-foreground">
                              {account.email}
                            </p>
                          </div>
                          <p className="text-paragraph mt-1 truncate text-xs">
                            {account.note || account.batch_code || '—'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge tone={account.enabled ? 'success' : 'outline'}>
                              {account.enabled ? '启用' : '停用'}
                            </Badge>
                            {account.is_consumed ? (
                              <Badge tone="primary">占用</Badge>
                            ) : (
                              <Badge tone="secondary">可分配</Badge>
                            )}
                            <Badge tone="outline">收 {account.inbox_count}</Badge>
                          </div>
                        </div>
                        <button
                          type="button"
                          title="获取新邮件"
                          aria-label={`获取 ${account.email} 的新邮件`}
                          disabled={syncingId !== null}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleSyncAccount(account.id)
                          }}
                          className={cn(
                            'shrink-0 rounded-lg p-2 transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground hover:brightness-105'
                              : 'bg-accent text-primary hover:bg-primary/15',
                            syncingThis && 'opacity-80',
                          )}
                        >
                          <RefreshCw
                            className={cn('h-3.5 w-3.5', syncingThis && 'animate-spin')}
                          />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <span className="text-paragraph text-xs">
              {page} / {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </section>

        {/* Message list / account empty */}
        <section className={cn('min-h-0 w-full shrink-0 flex-col border-r border-border bg-background xl:flex xl:w-[290px] 2xl:w-[330px]', mobilePane === 'messages' ? 'flex' : 'hidden')}>
          {!selected ? (
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="选择一个邮箱"
              description="选择邮箱后查看邮件"
            />
          ) : (
            <>
              <div className="border-b border-border/70 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-headline text-sm">{selected.email}</p>
                    <p className="text-paragraph text-xs">
                      上次同步 {formatRelativeTime(selected.last_synced_at)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => void handleSyncAccount(selected.id)}
                    disabled={syncingId !== null}
                    title="获取新邮件"
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', syncingId === selected.id && 'animate-spin')}
                    />
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-accent/60 p-1">
                  {(
                    [
                      { value: 'inbox', label: `收件箱 (${selected.inbox_count})` },
                      { value: 'sent', label: `已发送 (${selected.sent_count})` },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={cn(
                        'rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                        folder === item.value
                          ? 'bg-card text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => {
                        setFolder(item.value)
                        void loadMessages(selected.id, item.value)
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="scroll-area min-h-0 flex-1">
                {loadingMessages ? (
                  <LoadingState label="加载邮件…" />
                ) : messages.length === 0 ? (
                  <EmptyState
                    title="暂无邮件"
                    description="点击左侧卡片或上方刷新按钮获取新邮件"
                  />
                ) : (
                  <div className="space-y-1 p-2">
                    {messages.map((message) => {
                      const active = selectedMessage?.id === message.id
                      return (
                        <button
                          key={message.id}
                          type="button"
                          onClick={() => { void openMessage(message); setMobilePane('detail') }}
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
                              ? message.recipient_summary || '—'
                              : formatSender(message.sender_name, message.sender_email)}
                          </p>
                          <p className="text-paragraph mt-1 truncate-2 text-xs leading-relaxed">
                            {message.preview || '—'}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Detail pane */}
        <section className={cn('min-h-0 min-w-0 flex-1 flex-col bg-muted/30 xl:flex', mobilePane === 'detail' ? 'flex' : 'hidden')}>
          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-secondary"><Mail className="h-5 w-5" /></div>
                <h2 className="text-headline text-sm">邮件详情</h2>
                <p className="mt-1 text-xs text-muted-foreground">选择邮件后查看</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
                <div className="mr-auto flex min-w-0 items-center gap-2">
                  {selectedMessage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedMessage(null); setMobilePane('messages') }}
                      className="xl:hidden" aria-label="返回邮件列表"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {selectedMessage ? selectedMessage.subject || '(无主题)' : selected.email}
                    </p>
                    <p className="text-paragraph truncate text-xs">
                      {selectedMessage
                        ? `${folder === 'sent' ? '收件人' : '发件人'}：${
                            folder === 'sent'
                              ? selectedMessage.recipient_summary
                              : formatSender(selectedMessage.sender_name, selectedMessage.sender_email)
                          } · ${formatTime(selectedMessage.sent_at)}`
                        : `${
                            selected.is_consumed ? '使用中' : '可分配'
                          }`}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await copyText(selected.email)
                    toast.success('邮箱已复制')
                  }}
                >
                  <Copy className="h-4 w-4" />
                  复制
                </Button>
                <AccountActions
                  account={selected}
                  busy={actionBusy}
                  onBusy={setActionBusy}
                  onRefresh={async () => {
                    await Promise.all([refreshSelectedAccount(), loadAccounts(), loadMeta()])
                  }}
                  onConsume={() => setSiteActionOpen('consume')}
                  onRelease={() => setSiteActionOpen('release')}
                />
              </div>

              <div className="scroll-area min-h-0 flex-1">
                {loadingDetail ? (
                  <LoadingState label="打开邮件…" />
                ) : selectedMessage ? (
                  <MessageBody message={selectedMessage} />
                ) : (
                  <AccountOverview account={selected} />
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <ComposeDialog
        open={composeOpen}
        accountId={selected?.id}
        fromEmail={selected?.email}
        onClose={() => setComposeOpen(false)}
        onSent={async () => {
          setComposeOpen(false)
          if (selected) {
            await Promise.all([loadMessages(selected.id, 'sent'), refreshSelectedAccount()])
            setFolder('sent')
          }
          toast.success('邮件已发送')
        }}
      />

      <SiteActionDialog
        mode={siteActionOpen}
        account={selected}
        sites={sites}
        onClose={() => setSiteActionOpen(null)}
        onDone={async () => {
          setSiteActionOpen(null)
          await Promise.all([refreshSelectedAccount(), loadAccounts(), loadMeta()])
        }}
      />
    </div>
  )
}

function AccountActions({
  account,
  busy,
  onBusy,
  onRefresh,
  onConsume,
  onRelease,
}: {
  account: AccountDetail
  busy: string | null
  onBusy: (value: string | null) => void
  onRefresh: () => Promise<void>
  onConsume: () => void
  onRelease: () => void
}) {
  const toast = useToast()

  const togglePin = async () => {
    onBusy('pin')
    try {
      await updateAccount(account.id, { is_pinned: !account.is_pinned })
      await onRefresh()
      toast.success(account.is_pinned ? '已取消置顶' : '已置顶')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      onBusy(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" disabled={busy !== null} aria-label="邮箱操作">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {[
          { label: account.is_pinned ? '取消置顶' : '置顶邮箱', icon: account.is_pinned ? PinOff : Pin, onClick: togglePin },
          { label: '占用到站点', icon: Building2, onClick: onConsume },
          { label: '释放站点占用', icon: ExternalLink, onClick: onRelease },
        ].map((item) => (
          <DropdownMenuItem key={item.label} className="gap-2 py-2.5" onSelect={() => { void item.onClick() }}>
            <item.icon className="h-4 w-4" />{item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountOverview({ account }: { account: AccountDetail }) {
  return (
    <div className="space-y-4 p-6">
      <div className="surface p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-headline text-base">{account.email}</h3>
            <p className="text-paragraph text-[13px] leading-relaxed">
              批次 {account.batch_code || '—'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={account.enabled ? 'success' : 'outline'}>{account.enabled ? '启用' : '停用'}</Badge>
              <Badge tone={account.is_consumed ? 'primary' : 'secondary'}>
                {account.is_consumed ? '使用中' : '可分配'}
              </Badge>
              {account.has_oauth ? <Badge tone="primary">OAuth</Badge> : null}
              {account.has_password ? <Badge tone="outline">密码</Badge> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface p-5">
          <p className="text-paragraph text-xs">邮件缓存</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-accent/70 px-3 py-3">
              <p className="text-paragraph text-xs">收件箱</p>
              <p className="text-headline mt-1 text-2xl">{account.inbox_count}</p>
            </div>
            <div className="rounded-md bg-accent/70 px-3 py-3">
              <p className="text-paragraph text-xs">已发送</p>
              <p className="text-headline mt-1 text-2xl">{account.sent_count}</p>
            </div>
          </div>
          <p className="text-paragraph mt-3 text-xs">
            上次同步：{formatTime(account.last_synced_at)}
          </p>
          {account.last_error ? (
            <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {account.last_error}
            </p>
          ) : null}
        </div>

        <div className="surface p-5">
          <p className="text-paragraph text-xs">站点占用</p>
          {account.active_sites.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">当前没有站点占用记录</p>
          ) : (
            <div className="mt-3 space-y-2">
              {account.active_sites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{site.site_code}</p>
                    <p className="text-paragraph text-xs">{site.site_name || site.source}</p>
                  </div>
                  <Badge tone="primary">{formatRelativeTime(site.used_at)}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBody({ message }: { message: MessageDetail }) {
  const [mode, setMode] = useState<'html' | 'text'>('html')
  const hasHtml = Boolean(message.body_html && message.body_html.trim())

  return (
    <div className="p-6">
      <div className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
          <p className="text-headline text-[15px]">{message.subject || '(无主题)'}</p>
          <div className="flex shrink-0 rounded-lg bg-accent/70 p-1">
            <button
              type="button"
              onClick={() => setMode('html')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                mode === 'html' ? 'bg-card text-foreground' : 'text-muted-foreground',
              )}
            >
              原文
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                mode === 'text' ? 'bg-card text-foreground' : 'text-muted-foreground',
              )}
            >
              纯文本
            </button>
          </div>
        </div>
        <div className="px-5 py-4">
          {mode === 'html' && hasHtml ? (
            <MailHtmlFrame html={message.body_html} />
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
              {message.body_text || message.preview || '(空正文)'}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

function ComposeDialog({
  open,
  accountId,
  fromEmail,
  onClose,
  onSent,
}: {
  open: boolean
  accountId?: number
  fromEmail?: string
  onClose: () => void
  onSent: () => Promise<void>
}) {
  const toast = useToast()
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!accountId) return
    if (!to.trim() || !subject.trim()) {
      toast.error('请填写收件人和主题')
      return
    }
    setLoading(true)
    try {
      await sendMail(accountId, {
        to: to.trim(),
        cc: cc.trim(),
        subject: subject.trim(),
        body_text: body,
      })
      setTo('')
      setCc('')
      setSubject('')
      setBody('')
      await onSent()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发送失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="写信"
      description={fromEmail ? `使用 ${fromEmail} 发送` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            <Send className="h-4 w-4" />
            发送
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="stationpage-field-4">收件人</Label>
          <Input id="stationpage-field-4" value={to} onChange={(e) => setTo(e.target.value)} placeholder="someone@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stationpage-field-5">抄送</Label>
          <Input id="stationpage-field-5" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="可选" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stationpage-field-6">主题</Label>
          <Input id="stationpage-field-6" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stationpage-field-7">正文</Label>
          <Textarea id="stationpage-field-7" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </div>
    </Dialog>
  )
}

function SiteActionDialog({
  mode,
  account,
  sites,
  onClose,
  onDone,
}: {
  mode: 'consume' | 'release' | null
  account: AccountDetail | null
  sites: SiteItem[]
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [siteCode, setSiteCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode) setSiteCode(account?.active_sites[0]?.site_code || sites[0]?.code || '')
  }, [mode, account, sites])

  const submit = async () => {
    if (!account || !siteCode) {
      toast.error('请选择站点')
      return
    }
    setLoading(true)
    try {
      if (mode === 'consume') {
        await consumeAccount(account.id, { site_code: siteCode })
        toast.success(`已占用站点 ${siteCode}`)
      } else {
        await releaseAccount(account.id, { site_code: siteCode })
        toast.success(`已释放站点 ${siteCode}`)
      }
      await onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={Boolean(mode)}
      onClose={onClose}
      title={mode === 'consume' ? '占用到站点' : '释放站点占用'}
      description={account?.email}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            确认
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="stationpage-field-9">站点</Label>
        <Select id="stationpage-field-9" value={siteCode} onChange={(e) => setSiteCode(e.target.value)}>
          <option value="">请选择</option>
          {sites.map((site) => (
            <option key={site.id} value={site.code}>
              {site.code} · {site.name}
            </option>
          ))}
        </Select>
      </div>
    </Dialog>
  )
}

