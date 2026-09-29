import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckSquare,
  ClipboardCopy,
  Copy,
  Download,
  FileUp,
  KeyRound,
  RefreshCw,
  Search,
  Square,
  Table2,
  Trash2,
} from 'lucide-react'
import {
  batchDeleteAccounts,
  batchUpdateAccounts,
  deleteAccount,
  exportAccountsTxt,
  fetchAccounts,
  fetchAuthStatus,
  fetchSites,
  fetchUsers,
  importAccounts,
} from '@/lib/api'
import { copyText } from '@/lib/format'
import type { AccountItem, AccountScope, SiteItem, UserIdentity, UserItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge, Label, Select } from '@/components/ui/primitives'
import { Dialog } from '@/components/common/AppDialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, LoadingState, SearchEmpty } from '@/components/common/states'

const PAGE_SIZE = 20

type CopyMode = 'email' | 'password' | 'combo'

export function AccountsManagePage() {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadSequence = useRef(0)

  const [items, setItems] = useState<AccountItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const searchTimer = useRef<number | null>(null)
  const [scope, setScope] = useState<AccountScope>('all')
  const [groupFilter, setGroupFilter] = useState('')
  const [sites, setSites] = useState<SiteItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [currentUser, setCurrentUser] = useState<UserIdentity | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectAllPage, setSelectAllPage] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importGroup, setImportGroup] = useState('')
  const [importOwnerId, setImportOwnerId] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [pendingFileName, setPendingFileName] = useState('')

  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupValue, setGroupValue] = useState('')
  const [groupLoading, setGroupLoading] = useState(false)

  const [busy, setBusy] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchSites(), fetchUsers(), fetchAuthStatus()])
      .then(([siteResult, userResult, authResult]) => {
        if (cancelled) return
        setSites(siteResult.items)
        setUsers(userResult.items.filter((user) => user.role !== 'admin' && user.enabled))
        setCurrentUser(authResult.user)
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : '加载站点和用户失败')
      })
    return () => { cancelled = true }
  }, [toast])

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setLoading(true)
    try {
      const result = await fetchAccounts({
        page,
        pageSize: PAGE_SIZE,
        keyword: searchKeyword,
        scope,
        groupSiteId: groupFilter ? Number(groupFilter) : null,
      })
      if (sequence !== loadSequence.current) return
      if (page > result.total_pages) {
        setPage(result.total_pages)
        return
      }
      setItems(result.items)
      setTotal(result.total)
      setTotalPages(result.total_pages)
      setSelectedIds(new Set())
      setSelectAllPage(false)
    } catch (error) {
      if (sequence === loadSequence.current) {
        toast.error(error instanceof Error ? error.message : '加载邮箱失败')
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [page, scope, groupFilter, searchKeyword, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current)
    }
  }, [])

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  )

  const toggleRow = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectAllPage(false)
  }

  const toggleSelectPage = () => {
    if (selectAllPage) {
      setSelectedIds(new Set())
      setSelectAllPage(false)
      return
    }
    setSelectedIds(new Set(items.map((item) => item.id)))
    setSelectAllPage(true)
  }

  const copySelected = async (mode: CopyMode) => {
    if (selectedItems.length === 0) {
      toast.error('请先勾选邮箱')
      return
    }
    const lines = selectedItems.map((item) => {
      if (mode === 'email') return item.email
      if (mode === 'password') return item.password || ''
      return `${item.email}----${item.password || ''}`
    })
    await copyText(lines.join('\n'))
    toast.success(`已复制 ${selectedItems.length} 条（${
      mode === 'email' ? '账户' : mode === 'password' ? '密码' : '账户----密码'
    }）`)
  }

  const exportTxt = async () => {
    if (total === 0) {
      toast.error('没有可导出的邮箱')
      return
    }
    setExportLoading(true)
    try {
      const selected = selectedItems.length > 0
      const result = selected
        ? {
            blob: new Blob(
              [selectedItems.map((item) => `${item.email}----${item.password || ''}`).join('\n')],
              { type: 'text/plain;charset=utf-8' },
            ),
            filename: `accounts-${selectedItems.length}.txt`,
          }
        : await exportAccountsTxt({
            keyword: searchKeyword,
            scope,
            groupSiteId: groupFilter ? Number(groupFilter) : null,
          })
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(selected ? `已导出 ${selectedItems.length} 条为 txt` : '已导出全部匹配邮箱为 txt')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setExportLoading(false)
    }
  }

  const applyImportText = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      toast.error('没有可导入的内容')
      return
    }
    if (!currentUser) {
      toast.error('无法确认当前登录用户，请刷新后重试')
      return
    }
    if (currentUser.role === 'admin' && !importOwnerId) {
      toast.error('请先选择邮箱归属用户')
      return
    }
    setImportLoading(true)
    try {
      const result = await importAccounts({
        data: trimmed,
        enabled: true,
        group_site_id: importGroup ? Number(importGroup) : null,
        owner_user_id: currentUser.role === 'admin' ? Number(importOwnerId) : undefined,
      })
      toast.success(
        `导入完成：新增 ${result.created}，更新 ${result.updated}，失败 ${result.failed}`,
      )
      if (result.errors.length) {
        toast.error(result.errors.slice(0, 3).join('；'))
      }
      setImportText('')
      setPendingFileName('')
      setImportOpen(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setImportLoading(false)
    }
  }

  const onPickFile = async (file: File) => {
    const text = await file.text()
    setPendingFileName(file.name)
    setImportText(text)
    setImportOpen(true)
  }

  const applyGroup = async () => {
    if (selectedIds.size === 0) return
    setGroupLoading(true)
    try {
      await batchUpdateAccounts({
        account_ids: Array.from(selectedIds),
        group_site_id: groupValue ? Number(groupValue) : null,
      })
      toast.success(`已更新 ${selectedIds.size} 个邮箱的分组`)
      setGroupDialogOpen(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '修改分组失败')
    } finally {
      setGroupLoading(false)
    }
  }

  const applyBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`确认删除勾选的 ${selectedIds.size} 个邮箱？`)) return
    setBusy(true)
    try {
      const result = await batchDeleteAccounts(Array.from(selectedIds))
      toast.success(result.message || '已删除')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-layout">
      <header className="page-header block">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-headline text-lg leading-tight">邮箱管理</h1>
            <p className="text-paragraph text-xs">
              共 {total} 个邮箱 · 勾选后可批量复制 / 改分组 / 删除
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4" />
              导入
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportTxt()} loading={exportLoading}>
              <Download className="h-4 w-4" />
              导出 txt
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
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
          <Select
            className="h-9 w-[140px]"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as AccountScope)
              setPage(1)
            }}
          >
            <option value="all">全部状态</option>
            <option value="pool">可分配</option>
            <option value="consumed">使用中</option>
          </Select>
          <Select
            className="h-9 w-[160px]"
            value={groupFilter}
            onChange={(e) => {
              setGroupFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">全部分组</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name || site.code}（{site.code}）
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-accent/30 px-3 py-2">
          <span className="text-paragraph text-xs">
            已勾选 <strong className="text-foreground">{selectedIds.size}</strong> 项
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void copySelected('email')} disabled={!selectedIds.size}>
              <Copy className="h-3.5 w-3.5" />
              复制账户
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copySelected('password')} disabled={!selectedIds.size}>
              <KeyRound className="h-3.5 w-3.5" />
              复制密码
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copySelected('combo')} disabled={!selectedIds.size}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              复制账户----密码
            </Button>
            <Button variant="outline" size="sm" onClick={() => setGroupDialogOpen(true)} disabled={!selectedIds.size}>
              批量改分组
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void applyBatchDelete()}
              disabled={!selectedIds.size || busy}
            >
              <Trash2 className="h-3.5 w-3.5" />
              批量删除
            </Button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {loading ? (
          <LoadingState label="加载邮箱…" />
        ) : items.length === 0 ? (
          searchKeyword || groupFilter ? (
            <SearchEmpty keyword={searchKeyword || sites.find((site) => String(site.id) === groupFilter)?.name || groupFilter} />
          ) : (
            <EmptyState
              icon={<Table2 className="h-6 w-6" />}
              title="暂无邮箱"
              description="点击右上角「导入」按行批量添加账号"
            />
          )
        ) : (
          <div className="surface overflow-hidden">
            <div>
              <Table className="w-full min-w-[920px] border-collapse text-sm">
                <TableHeader>
                  <TableRow className="border-b border-border bg-accent/40 text-left text-xs text-muted-foreground">
                    <TableHead className="w-12 px-3 py-3">
                      <button type="button" onClick={toggleSelectPage} aria-label="全选本页">
                        {selectAllPage ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-14 px-3 py-3">序号</TableHead>
                    <TableHead className="px-3 py-3">邮箱</TableHead>
                    <TableHead className="px-3 py-3">密码</TableHead>
                    <TableHead className="px-3 py-3">分组</TableHead>
                    <TableHead className="px-3 py-3">令牌状态</TableHead>
                    <TableHead className="px-3 py-3">权限类型</TableHead>
                    <TableHead className="px-3 py-3">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const checked = selectedIds.has(item.id)
                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          'border-b border-border/60 last:border-0',
                          checked ? 'bg-primary/8' : 'hover:bg-accent/30',
                        )}
                      >
                        <TableCell className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleRow(item.id)}
                            aria-label={checked ? '取消选择' : '选择'}
                          >
                            {checked ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-muted-foreground">
                          {(page - 1) * PAGE_SIZE + index + 1}
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="max-w-[220px] truncate font-medium text-foreground">
                              {item.email}
                            </span>
                            <button
                              type="button"
                              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-primary"
                              title="复制邮箱"
                              onClick={async () => {
                                await copyText(item.email)
                                toast.success('邮箱已复制')
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="max-w-[120px] truncate font-mono text-xs text-muted-foreground">
                              {item.password ? '••••••••' : '—'}
                            </span>
                            <button
                              type="button"
                              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-primary"
                              title="复制密码"
                              disabled={!item.password}
                              onClick={async () => {
                                await copyText(item.password)
                                toast.success('密码已复制')
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          {item.group_site_id ? (
                            <Badge tone="secondary">{item.group_site_name || item.group_site_code}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <Badge tone={item.token_status === '已配置' ? 'success' : 'outline'}>
                            {item.token_status || '未配置'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <Badge tone={item.permission_type.includes('OAuth') ? 'primary' : 'outline'}>
                            {item.permission_type || '未知'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await copyText(`${item.email}----${item.password || ''}`)
                                toast.success('已复制账户----密码')
                              }}
                            >
                              复制
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={async () => {
                                if (!window.confirm(`确认删除 ${item.email}？`)) return
                                try {
                                  await deleteAccount(item.id)
                                  toast.success('已删除')
                                  await load()
                                } catch (error) {
                                  toast.error(error instanceof Error ? error.message : '删除失败')
                                }
                              }}
                            >
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
              <p className="text-paragraph text-xs">
                第 {page} / {Math.max(1, totalPages)} 页 · 共 {total} 条
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,text/plain"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) await onPickFile(file)
          e.target.value = ''
        }}
      />

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="导入邮箱"
        description="支持文本粘贴或选择文件按行批量导入；格式 email----password 或 email----password----client_id----refresh_token"
        footer={
          <>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              选择文件
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => void applyImportText(importText)}
              loading={importLoading}
            >
              开始导入
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {pendingFileName ? (
            <p className="text-paragraph text-xs">已载入文件：{pendingFileName}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="accountsmanagepage-field-1">账号数据（按行批量）</Label>
            <Textarea id="accountsmanagepage-field-1"
              rows={12}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'demo@outlook.com----password\ndemo2@outlook.com----password----client_id----refresh_token'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountsmanagepage-field-2">站点分组（可选）</Label>
            <Select id="accountsmanagepage-field-2"
              value={importGroup}
              onChange={(e) => setImportGroup(e.target.value)}
            >
              <option value="">不设置分组</option>
              {sites.filter((site) => site.enabled).map((site) => (
                <option key={site.id} value={site.id}>{site.name || site.code}（{site.code}）</option>
              ))}
            </Select>
          </div>
          {currentUser?.role === 'admin' ? (
            <div className="space-y-2">
              <Label htmlFor="accountsmanagepage-field-3">归属用户</Label>
              <Select id="accountsmanagepage-field-3" value={importOwnerId} onChange={(e) => setImportOwnerId(e.target.value)}>
                <option value="">请选择用户</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.username}</option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        title="批量修改分组"
        description={`将对已勾选的 ${selectedIds.size} 个邮箱生效`}
        footer={
          <>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void applyGroup()} loading={groupLoading}>
              确认修改
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="accountsmanagepage-field-4">新站点分组</Label>
          <Select id="accountsmanagepage-field-4"
            value={groupValue}
            onChange={(e) => setGroupValue(e.target.value)}
          >
            <option value="">清空分组</option>
            {sites.filter((site) => site.enabled).map((site) => (
              <option key={site.id} value={site.id}>{site.name || site.code}（{site.code}）</option>
            ))}
          </Select>
          <p className="text-paragraph text-xs leading-relaxed">
            分组只用于整理和筛选邮箱，不产生占用关系；业务领取/释放走「站点占用」，由开放接口或工作台操作。
          </p>
        </div>
      </Dialog>
    </div>
  )
}
