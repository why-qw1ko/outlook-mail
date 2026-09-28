import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Copy,
  ExternalLink,
  Import,
  Inbox,
  Loader2,
  Mail,
  MailPlus,
  MoreHorizontal,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Send,
  Share2,
  Trash2,
  UserRound,
} from 'lucide-react'
import {
  consumeAccount,
  createShare,
  deleteAccount,
  fetchAccountDetail,
  fetchAccounts,
  fetchMessageDetail,
  fetchMessages,
  fetchPoolSummary,
  fetchSites,
  fetchUsers,
  importAccounts,
  moveAccountsToUserPool,
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
  UserItem,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { MailHtmlFrame } from '@/components/common/MailHtmlFrame'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge, Label, Select } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, LoadingState, SearchEmpty } from '@/components/common/states'

const PAGE_SIZE = 50

export function StationPage() {
  const toast = useToast()

  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [scope, setScope] = useState<AccountScope>('all')
  const [batchCode, setBatchCode] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [sites, setSites] = useState<SiteItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [pool, setPool] = useState<{ pool_count: number; consumed_count: number } | null>(null)

  const [selected, setSelected] = useState<AccountDetail | null>(null)
  const [folder, setFolder] = useState<MessageFolder>('inbox')
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [siteActionOpen, setSiteActionOpen] = useState<'consume' | 'release' | null>(null)

  const keywordRef = useRef(keyword)
  keywordRef.current = keyword

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const result = await fetchAccounts({
        page,
        pageSize: PAGE_SIZE,
        keyword: keywordRef.current,
        scope,
        batchCode,
        siteCode,
      })
      setAccounts(result.items)
      setTotal(result.total)
      setTotalPages(result.total_pages)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载邮箱列表失败')
    } finally {
      setLoadingAccounts(false)
    }
  }, [page, scope, batchCode, siteCode, toast])

  const loadMeta = useCallback(async () => {
    try {
      const [siteResult, poolResult, userResult] = await Promise.all([
        fetchSites(),
        fetchPoolSummary(),
        fetchUsers().catch(() => ({ items: [] as UserItem[] })),
      ])
      setSites(siteResult.items.filter((item) => item.enabled))
      setPool({ pool_count: poolResult.pool_count, consumed_count: poolResult.consumed_count })
      setUsers(userResult.items)
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

  const filteredLabel = useMemo(() => {
    if (keyword) return `匹配「${keyword}」`
    if (scope === 'pool') return '未占用'
    if (scope === 'consumed') return '使用中'
    return '全部邮箱'
  }, [keyword, scope])

  return (
    <div className="flex h-screen min-w-0 flex-col">
      {/* Top toolbar */}
      <header className="glass-bar z-20 flex h-[64px] shrink-0 items-center gap-3 border-b border-border px-5">
        <div className="min-w-0">
          <h1 className="text-headline text-lg leading-tight">邮箱站</h1>
          <p className="text-paragraph text-xs">
            共 {total} 个邮箱
            {pool ? ` · 池内 ${pool.pool_count} · 使用中 ${pool.consumed_count}` : ''}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="搜索邮箱 / 备注 / 批次"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadAccounts()
              }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Import className="h-4 w-4" />
            导入
          </Button>
          <Button variant="outline" size="sm" onClick={() => setComposeOpen(true)} disabled={!selected}>
            <MailPlus className="h-4 w-4" />
            写信
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Account list */}
        <section className="flex w-[300px] shrink-0 flex-col border-r border-border bg-card/70">
          <div className="space-y-2 border-b border-border/70 px-3 py-3">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-accent/60 p-1">
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
                    'rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                    scope === item.value
                      ? 'bg-card text-foreground shadow-soft'
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadAccounts()
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
                <EmptyState title="暂无邮箱" description="点击右上角「导入」批量添加 Outlook 账号" />
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
                      onClick={() => void selectAccount(account)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void selectAccount(account)
                        }
                      }}
                      className={cn(
                        'w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition-all',
                        active
                          ? 'border-primary/40 bg-primary/10 shadow-soft'
                          : 'border-transparent bg-card hover:border-border hover:bg-accent/40',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {account.is_pinned ? <Pin className="h-3 w-3 shrink-0 text-primary" /> : null}
                            <p className="truncate text-[13px] font-medium text-foreground">
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
        <section className="flex w-[340px] shrink-0 flex-col border-r border-border bg-background">
          {!selected ? (
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="选择一个邮箱"
              description={`左侧为邮箱池（${filteredLabel}）。选中后可查看邮件、手动获取新邮件并执行占用管理。`}
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
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-accent/60 p-1">
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
                          ? 'bg-card text-foreground shadow-soft'
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
        <section className="flex min-w-0 flex-1 flex-col bg-background/70">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center px-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-primary">
                  <Inbox className="h-7 w-7" />
                </div>
                <h2 className="text-headline text-xl">Outlook 邮件工作台</h2>
                <p className="text-paragraph mt-3 text-sm leading-relaxed">
                  左侧选择邮箱后，在此查看邮件正文、执行获取邮件、分享链接、站点占用与写信。
                  邮件获取为手动操作，不会倒计时自动刷新。
                </p>
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
                      onClick={() => setSelectedMessage(null)}
                      className="lg:hidden"
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
                        : `归属 ${selected.owner_username || '未分配'} · ${
                            selected.is_consumed ? '使用中' : '可分配'
                          }`}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShareOpen(true)}
                  title="生成公开分享链接"
                >
                  <Share2 className="h-4 w-4" />
                  分享
                </Button>
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
                  onMove={() => setMoveOpen(true)}
                  onDelete={async () => {
                    setSelected(null)
                    setMessages([])
                    setSelectedMessage(null)
                    await loadAccounts()
                  }}
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

      <ImportDialog
        open={importOpen}
        users={users}
        onClose={() => setImportOpen(false)}
        onDone={async () => {
          setImportOpen(false)
          await Promise.all([loadAccounts(), loadMeta()])
        }}
      />

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

      <ShareDialog
        open={shareOpen}
        accountId={selected?.id}
        email={selected?.email}
        onClose={() => setShareOpen(false)}
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

      <MovePoolDialog
        open={moveOpen}
        account={selected}
        users={users}
        onClose={() => setMoveOpen(false)}
        onDone={async () => {
          setMoveOpen(false)
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
  onMove,
  onDelete,
}: {
  account: AccountDetail
  busy: string | null
  onBusy: (value: string | null) => void
  onRefresh: () => Promise<void>
  onConsume: () => void
  onRelease: () => void
  onMove: () => void
  onDelete: () => Promise<void>
}) {
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)

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

  const toggleEnabled = async () => {
    onBusy('enabled')
    try {
      await updateAccount(account.id, { enabled: !account.enabled })
      await onRefresh()
      toast.success(account.enabled ? '已停用邮箱' : '已启用邮箱')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      onBusy(null)
    }
  }

  const remove = async () => {
    if (!window.confirm(`确认删除邮箱 ${account.email}？相关缓存会一并清理。`)) return
    onBusy('delete')
    try {
      await deleteAccount(account.id)
      toast.success('邮箱已删除')
      await onDelete()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      onBusy(null)
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={busy !== null}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </Button>
      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-48 animate-fade-in overflow-hidden rounded-xl border border-border bg-card shadow-float">
            {[
              {
                label: account.is_pinned ? '取消置顶' : '置顶邮箱',
                icon: account.is_pinned ? PinOff : Pin,
                onClick: togglePin,
              },
              { label: account.enabled ? '停用邮箱' : '启用邮箱', icon: BadgeCheck, onClick: toggleEnabled },
              { label: '占用到站点', icon: Building2, onClick: () => { setMenuOpen(false); onConsume() } },
              { label: '释放站点占用', icon: ExternalLink, onClick: () => { setMenuOpen(false); onRelease() } },
              { label: '转移用户池', icon: UserRound, onClick: () => { setMenuOpen(false); onMove() } },
              { label: '删除邮箱', icon: Trash2, onClick: remove, danger: true },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-accent',
                  item.danger ? 'text-destructive' : 'text-foreground',
                )}
                onClick={() => {
                  setMenuOpen(false)
                  void item.onClick()
                }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function AccountOverview({ account }: { account: AccountDetail }) {
  return (
    <div className="space-y-4 p-6">
      <div className="surface p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-headline text-base">{account.email}</h3>
            <p className="text-paragraph text-[13px] leading-relaxed">
              批次 {account.batch_code || '—'} · 归属 {account.owner_username || '未分配'}
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
            <div className="rounded-xl bg-accent/70 px-3 py-3">
              <p className="text-paragraph text-xs">收件箱</p>
              <p className="text-headline mt-1 text-2xl">{account.inbox_count}</p>
            </div>
            <div className="rounded-xl bg-accent/70 px-3 py-3">
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
                  className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5"
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
          <p className="text-paragraph mt-4 text-xs leading-relaxed">
            说明：点击邮箱卡片右上角刷新按钮获取新邮件，系统不会倒计时自动拉取。
          </p>
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
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
          <p className="text-headline text-[15px]">{message.subject || '(无主题)'}</p>
          <div className="flex rounded-xl bg-accent/70 p-1">
            <button
              type="button"
              onClick={() => setMode('html')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                mode === 'html' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground',
              )}
            >
              原文
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                mode === 'text' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground',
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

function ImportDialog({
  open,
  users,
  onClose,
  onDone,
}: {
  open: boolean
  users: UserItem[]
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [data, setData] = useState('')
  const [batchCode, setBatchCode] = useState('')
  const [ownerUserId, setOwnerUserId] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!data.trim()) {
      toast.error('请粘贴要导入的账号数据')
      return
    }
    setLoading(true)
    try {
      const result = await importAccounts({
        data,
        enabled,
        batch_code: batchCode.trim(),
        owner_user_id: ownerUserId ? Number(ownerUserId) : null,
      })
      toast.success(
        `导入完成：新增 ${result.created}，更新 ${result.updated}，失败 ${result.failed}`,
      )
      if (result.errors.length) {
        toast.error(result.errors.slice(0, 3).join('；'))
      }
      setData('')
      await onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="导入邮箱"
      description="支持 email----password 或 email----password----client_id----refresh_token，每行一条。"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            开始导入
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>账号数据</Label>
          <Textarea
            rows={10}
            placeholder={'demo@outlook.com----password\ndemo2@outlook.com----password----client_id----refresh_token'}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>批次代码（可选）</Label>
            <Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="batch-20260405" />
          </div>
          <div className="space-y-2">
            <Label>归属用户（可选）</Label>
            <Select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
              <option value="">不指定</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary"
          />
          导入后立即启用
        </label>
      </div>
    </Dialog>
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
          <Label>收件人</Label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="someone@example.com" />
        </div>
        <div className="space-y-2">
          <Label>抄送</Label>
          <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="可选" />
        </div>
        <div className="space-y-2">
          <Label>主题</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>正文</Label>
          <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </div>
    </Dialog>
  )
}

function ShareDialog({
  open,
  accountId,
  email,
  onClose,
}: {
  open: boolean
  accountId?: number
  email?: string
  onClose: () => void
}) {
  const toast = useToast()
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ url: string; expires_at: string } | null>(null)

  useEffect(() => {
    if (!open) setResult(null)
  }, [open])

  const submit = async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const share = await createShare(accountId, Number(days) || 30)
      setResult({ url: share.url, expires_at: share.expires_at })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成分享失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="公开分享链接"
      description={email ? `为 ${email} 创建只读访问链接` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          {!result ? (
            <Button onClick={() => void submit()} loading={loading}>
              <Share2 className="h-4 w-4" />
              生成链接
            </Button>
          ) : (
            <Button
              onClick={async () => {
                await copyText(result.url)
                toast.success('链接已复制')
              }}
            >
              <Copy className="h-4 w-4" />
              复制链接
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>有效天数</Label>
          <Select value={days} onChange={(e) => setDays(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => (i + 1) * 30).map((d) => (
              <option key={d} value={d}>
                {d} 天
              </option>
            ))}
          </Select>
        </div>
        {result ? (
          <div className="rounded-xl border border-primary/25 bg-primary/8 p-4">
            <p className="text-paragraph text-xs">分享链接</p>
            <p className="mt-2 break-all text-sm text-foreground">{result.url}</p>
            <p className="text-paragraph mt-2 text-xs">过期时间：{formatTime(result.expires_at)}</p>
          </div>
        ) : null}
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
        <Label>站点</Label>
        <Select value={siteCode} onChange={(e) => setSiteCode(e.target.value)}>
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

function MovePoolDialog({
  open,
  account,
  users,
  onClose,
  onDone,
}: {
  open: boolean
  account: AccountDetail | null
  users: UserItem[]
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && account) setUserId(String(account.owner_user_id ?? ''))
  }, [open, account])

  const submit = async () => {
    if (!account || !userId) {
      toast.error('请选择目标用户')
      return
    }
    setLoading(true)
    try {
      await moveAccountsToUserPool({
        account_ids: [account.id],
        owner_user_id: Number(userId),
      })
      toast.success('已转移用户池')
      await onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '转移失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="转移用户池"
      description={account?.email}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            确认转移
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label>目标用户</Label>
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">请选择</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </Select>
      </div>
    </Dialog>
  )
}

