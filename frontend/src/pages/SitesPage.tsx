import { useCallback, useEffect, useState } from 'react'
import { Plus, Settings2, ToggleLeft, ToggleRight } from 'lucide-react'
import { createSite, fetchSites, updateSite } from '@/lib/api'
import { formatTime } from '@/lib/format'
import type { SiteItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, Label } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, LoadingState } from '@/components/common/states'

export function SitesPage() {
  const toast = useToast()
  const [sites, setSites] = useState<SiteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

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
    <div className="flex h-screen min-w-0 flex-col">
      <header className="glass-bar z-20 flex h-[64px] shrink-0 items-center gap-3 border-b border-border px-5">
        <div>
          <h1 className="text-headline text-lg leading-tight">站点管理</h1>
          <p className="text-paragraph text-xs">
            业务系统消费邮箱时必须携带站点编码，占用与回退均按站点维度处理
          </p>
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            新建站点
          </Button>
        </div>
      </header>

      <div className="scroll-area flex-1 p-5">
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
              <div key={site.id} className="surface animate-fade-in p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-headline text-base">{site.code}</p>
                    <p className="text-paragraph mt-1 text-sm">{site.name}</p>
                  </div>
                  <Badge tone={site.enabled ? 'success' : 'outline'}>
                    {site.enabled ? '启用' : '停用'}
                  </Badge>
                </div>
                <p className="text-paragraph mt-4 text-xs">
                  更新于 {formatTime(site.updated_at)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full justify-start"
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
              </div>
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
    </div>
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
          <Label>站点编码</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="OPENAI" />
        </div>
        <div className="space-y-2">
          <Label>站点名称</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="OpenAI" />
        </div>
      </div>
    </Dialog>
  )
}
