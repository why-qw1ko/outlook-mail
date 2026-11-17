import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { createApiKey, deleteApiKey, fetchApiKeys, regenerateApiKey, updateApiKey } from '@/lib/api'
import type { ApiKeyItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/primitives'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, LoadingState } from '@/components/common/states'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import { formatTime } from '@/lib/format'

export function ApiKeysPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchApiKeys()
      setItems(result.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('请填写密钥名称')
      return
    }
    try {
      await createApiKey({ name: name.trim() })
      toast.success('已创建接入密钥')
      setCreateOpen(false)
      setName('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleToggle = async (item: ApiKeyItem) => {
    try {
      await updateApiKey(item.id, { enabled: !item.enabled })
      toast.success(item.enabled ? '已停用密钥' : '已启用密钥')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleRegenerate = async (item: ApiKeyItem) => {
    if (!(await confirm({ title: '轮换密钥', description: `轮换「${item.name}」后，旧密钥将立即失效。`, confirmText: '轮换', destructive: true }))) return
    try {
      await regenerateApiKey(item.id)
      toast.success('已轮换密钥')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '轮换失败')
    }
  }

  const handleDelete = async (item: ApiKeyItem) => {
    if (!(await confirm({ title: '删除密钥', description: `删除「${item.name}」后，使用该密钥的业务将无法调用开放接口。`, confirmText: '删除', destructive: true }))) return
    try {
      await deleteApiKey(item.id)
      toast.success('已删除密钥')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="page-header">
        <div>
          <h1 className="text-headline">接入密钥</h1>
          <p className="text-paragraph text-xs">用于调用开放接口</p>
        </div>
        <Badge tone="secondary" className="ml-auto">{loading ? '加载中…' : items.length + ' 把密钥'}</Badge>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新建密钥
        </Button>
      </div>

      <div className="page-content">
        {loading ? (
          <LoadingState label="正在加载接入密钥…" />
        ) : error ? (
          <EmptyState title="加载失败" description={error} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无接入密钥" description="创建密钥后可调用开放接口" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-headline truncate text-base">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">创建于 {formatTime(item.created_at)}</p>
                  </div>
                  <Badge tone={item.enabled ? 'success' : 'outline'}>{item.enabled ? '启用' : '停用'}</Badge>
                </div>
                <div className="mt-4 rounded-lg border bg-muted/40 px-3 py-2">
                  <p className="truncate font-mono text-xs text-muted-foreground">{item.key}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggle(item)}>
                    {item.enabled ? '停用' : '启用'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRegenerate(item)}>
                    <RefreshCw className="h-4 w-4" />
                    轮换
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(item)}>
                    <Trash2 className="h-4 w-4" />
                    删除
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建接入密钥</DialogTitle>
            <DialogDescription>为业务脚本创建独立密钥，便于单独停用或轮换。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="apikeys-name">名称</Label>
            <Input id="apikeys-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：注册脚本" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
