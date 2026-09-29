import { useCallback, useEffect, useState } from 'react'
import { Copy, KeyRound, Plus, RefreshCw, Shield, Trash2, Users } from 'lucide-react'
import { createUser, deleteUser, fetchUserApiKey, fetchUsers, regenerateUserApiKey, updateUser } from '@/lib/api'
import { copyText, formatTime } from '@/lib/format'
import type { UserItem } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, Label, Select } from '@/components/ui/primitives'
import { Dialog } from '@/components/common/AppDialog'
import { useToast } from '@/components/ui/toast'
import { EmptyState, LoadingState } from '@/components/common/states'

export function UsersPage() {
  const toast = useToast()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [apiKeyOpen, setApiKeyOpen] = useState<UserItem | null>(null)
  const [passwordUser, setPasswordUser] = useState<UserItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchUsers()
      setUsers(result.items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载用户失败')
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
          <h1 className="text-headline text-lg leading-tight">用户管理</h1>
          <p className="text-paragraph text-xs">管理后台账号与业务开放接口 API Key</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            新建用户
          </Button>
        </div>
      </header>

      <div className="page-content">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary"><Users className="h-5 w-5" /></div>
          <div><h2 className="text-sm font-semibold">全部用户</h2><p className="mt-0.5 text-xs text-muted-foreground">统一管理用户及其邮箱资源</p></div>
          <Badge tone="secondary" className="ml-auto">{loading ? '加载中…' : users.length + ' 个用户'}</Badge>
        </div>
        {loading ? (
          <LoadingState label="加载用户…" />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="暂无用户"
            description="创建用户后可分配邮箱池，并为其生成 API Key"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <Card key={user.id} className="animate-fade-in p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-headline truncate text-base">{user.username}</p>
                    <p className="text-paragraph mt-1 text-xs">
                      创建于 {formatTime(user.created_at)}
                    </p>
                  </div>
                  <Badge tone={user.enabled ? 'success' : 'outline'}>
                    {user.enabled ? '启用' : '停用'}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-accent/70 px-3 py-3">
                    <p className="text-paragraph text-xs">邮箱池</p>
                    <p className="text-headline mt-1 text-2xl">{user.pool_count}</p>
                  </div>
                  <div className="rounded-xl bg-accent/70 px-3 py-3">
                    <p className="text-paragraph text-xs">使用中</p>
                    <p className="text-headline mt-1 text-2xl">{user.consumed_count}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setApiKeyOpen(user)}
                  >
                    <KeyRound className="h-4 w-4" />
                    查看 / 重置 API Key
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setPasswordUser(user)}
                  >
                    <Shield className="h-4 w-4" />
                    修改密码
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={async () => {
                      try {
                        await updateUser(user.id, { enabled: !user.enabled })
                        toast.success(user.enabled ? '已停用用户' : '已启用用户')
                        await load()
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : '操作失败')
                      }
                    }}
                  >
                    {user.enabled ? '停用账号' : '启用账号'}
                  </Button>
                  {user.role !== 'admin' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-destructive"
                      onClick={async () => {
                        if (!window.confirm(`确认删除用户 ${user.username}？名下仍有邮箱时会删除失败。`)) return
                        try {
                          await deleteUser(user.id)
                          toast.success('用户已删除')
                          await load()
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : '删除失败')
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除用户
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={async () => {
          setCreateOpen(false)
          await load()
        }}
      />

      <UserApiKeyDialog
        user={apiKeyOpen}
        onClose={() => setApiKeyOpen(null)}
      />

      <ChangePasswordDialog
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
        onDone={async () => {
          setPasswordUser(null)
          await load()
        }}
      />
    </div>
  )
}

function ChangePasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: UserItem | null
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) setPassword('')
  }, [user])

  const submit = async () => {
    if (!user) return
    if (!password) {
      toast.error('请输入新密码')
      return
    }
    setLoading(true)
    try {
      await updateUser(user.id, { password })
      toast.success('密码已更新')
      setPassword('')
      await onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={Boolean(user)}
      onClose={onClose}
      title="修改密码"
      description={user ? `为用户 ${user.username} 设置新的登录密码` : undefined}
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
      <div className="space-y-2">
        <Label htmlFor="userspage-field-1">新密码</Label>
        <Input id="userspage-field-1"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 1 位"
        />
      </div>
    </Dialog>
  )
}

function CreateUserDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!username.trim() || !password) {
      toast.error('请填写用户名和密码')
      return
    }
    setLoading(true)
    try {
      await createUser({ username: username.trim(), password, role, enabled: true })
      toast.success('用户已创建')
      setUsername('')
      setPassword('')
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
      title="新建用户"
      description="创建普通用户后，可把邮箱池分配给该用户，并生成业务开放接口 API Key。"
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
          <Label htmlFor="userspage-field-2">用户名</Label>
          <Input id="userspage-field-2" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="userspage-field-3">密码</Label>
          <Input id="userspage-field-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="userspage-field-4">角色</Label>
          <Select id="userspage-field-4" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </Select>
        </div>
      </div>
    </Dialog>
  )
}

function UserApiKeyDialog({
  user,
  onClose,
}: {
  user: UserItem | null
  onClose: () => void
}) {
  const toast = useToast()
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setApiKey('')
    fetchUserApiKey(user.id)
      .then((result) => setApiKey(result.api_key))
      .catch((error) => toast.error(error instanceof Error ? error.message : '获取 API Key 失败'))
      .finally(() => setLoading(false))
  }, [user, toast])

  return (
    <Dialog
      open={Boolean(user)}
      onClose={onClose}
      title="用户 API Key"
      description={user ? `用户 ${user.username} 的业务开放接口密钥` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!user) return
              await copyText(apiKey)
              toast.success('API Key 已复制')
            }}
            disabled={!apiKey}
          >
            <Copy className="h-4 w-4" />
            复制
          </Button>
          <Button
            loading={regenerating}
            onClick={async () => {
              if (!user) return
              if (!window.confirm('重置后旧 API Key 将立即失效，确认继续？')) return
              setRegenerating(true)
              try {
                const result = await regenerateUserApiKey(user.id)
                setApiKey(result.api_key)
                toast.success('API Key 已重置')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : '重置失败')
              } finally {
                setRegenerating(false)
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
            重置
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingState label="读取 API Key…" />
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-primary/25 bg-primary/8 p-4">
            <p className="text-paragraph text-xs">API Key</p>
            <p className="mt-2 break-all font-mono text-sm text-foreground">{apiKey || '—'}</p>
          </div>
          <p className="text-paragraph text-xs leading-relaxed">
            业务系统调用 <code className="rounded bg-accent px-1.5 py-0.5">/api/open/*</code> 时，
            通过 <code className="rounded bg-accent px-1.5 py-0.5">X-API-Key</code> 或
            Bearer 方式携带该密钥。
          </p>
        </div>
      )}
    </Dialog>
  )
}
