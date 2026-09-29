import { useCallback, useEffect, useState } from 'react'
import { Plus, Settings2, ToggleLeft, ToggleRight, Trash2, Pencil } from 'lucide-react'
import { createSite, deleteSite, fetchSites, updateSite } from '@/lib/api'
import { formatTime } from '@/lib/format'
import type { SiteItem } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, Label } from '@/components/ui/primitives'
import { Dialog } from '@/components/common/AppDialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, LoadingState } from '@/components/common/states'

export function SitesPage() {
  const toast = useToast()
  const [sites, setSites] = useState<SiteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<SiteItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchSites()
      setSites(result.items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载站点失败')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <h1 className="text-headline text-lg leading-tight">站点管理</h1>
          <p className="text-paragraph text-xs">
            站点是业务方的领取单位（如 GPT、OpenAI）；分组只是邮箱归类标签。占用/释放按站点记录
          </p>
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            新建站点
          </Button>
        </div>
      </header>

      <div className="page-content">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary"><Settings2 className="h-5 w-5" /></div>
          <div><h2 className="text-sm font-semibold">全部站点</h2><p className="mt-0.5 text-xs text-muted-foreground">管理业务接入与邮箱占用</p></div>
          <Badge tone="secondary" className="ml-auto">{loading ? '加载中…' : sites.length + ' 个站点'}</Badge>
        </div>
        {loading ? (
          <LoadingState label="加载站点…" />
        ) : sites.length === 0 ? (
          <EmptyState
            icon={<Settings2 className="h-6 w-6" />}
            title="暂无站点"
            description="创建站点后，业务系统可按 site_code 领取和释放邮箱"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((site) => (
              <Card key={site.id} className="animate-fade-in p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-headline break-all text-base">{site.code}</p>
                    <p className="text-paragraph mt-1 break-words text-sm">{site.name}</p>
                  </div>
                  <Badge tone={site.enabled ? 'success' : 'outline'}>
                    {site.enabled ? '启用' : '停用'}
                  </Badge>
                </div>
                <p className="text-paragraph mt-4 text-xs">
                  更新于 {formatTime(site.updated_at)}
                </p>
                <div className="mt-4 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setEditingSite(site)}
                  >
                    <Pencil className="h-4 w-4" />
                    编辑站点
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={async () => {
                      try {
                        await updateSite(site.id, { enabled: !site.enabled })
                        toast.success(site.enabled ? '已停用站点' : '已启用站点')
                        await load()
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : '操作失败')
                      }
                    }}
                  >
                    {site.enabled ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                    {site.enabled ? '停用站点' : '启用站点'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive"
                    onClick={async () => {
                      if (!window.confirm(`确认删除站点 ${site.code}？未释放占用时会删除失败。`)) return
                      try {
                        await deleteSite(site.id)
                        toast.success('站点已删除')
                        await load()
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : '删除失败')
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    删除站点
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateSiteDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={async () => {
          setCreateOpen(false)
          await load()
        }}
      />

      <EditSiteDialog
        site={editingSite}
        onClose={() => setEditingSite(null)}
        onDone={async () => {
          setEditingSite(null)
          await load()
        }}
      />
    </div>
  )
}

function EditSiteDialog({
  site,
  onClose,
  onDone,
}: {
  site: SiteItem | null
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!site) return
    setCode(site.code)
    setName(site.name)
  }, [site])

  const submit = async () => {
    if (!site) return
    if (!code.trim() || !name.trim()) {
      toast.error('请填写站点编码和名称')
      return
    }
    setLoading(true)
    try {
      await updateSite(site.id, { code: code.trim(), name: name.trim() })
      toast.success('站点已更新')
      await onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={Boolean(site)}
      onClose={onClose}
      title="编辑站点"
      description="修改站点编码或名称；编码会被业务接口引用，请谨慎修改。"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sitespage-field-1">站点编码</Label>
          <Input id="sitespage-field-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="OPENAI" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sitespage-field-2">站点名称</Label>
          <Input id="sitespage-field-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="OpenAI" />
        </div>
      </div>
    </Dialog>
  )
}

function CreateSiteDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error('请填写站点编码和名称')
      return
    }
    setLoading(true)
    try {
      await createSite({ code: code.trim(), name: name.trim(), enabled: true })
      toast.success('站点已创建')
      setCode('')
      setName('')
      await onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="新建站点"
      description="站点编码需唯一，业务系统将使用该编码申请邮箱。"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sitespage-field-3">站点编码</Label>
          <Input id="sitespage-field-3" value={code} onChange={(e) => setCode(e.target.value)} placeholder="OPENAI" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sitespage-field-4">站点名称</Label>
          <Input id="sitespage-field-4" value={name} onChange={(e) => setName(e.target.value)} placeholder="OpenAI" />
        </div>
      </div>
    </Dialog>
  )
}
