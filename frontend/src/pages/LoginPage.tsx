import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Lock, User } from 'lucide-react'
import { login, setAdminToken } from '@/lib/api'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'

export function LoginPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      toast.error('请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      const result = await login({ username: username.trim(), password })
      setAdminToken(result.access_token)
      toast.success('登录成功')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-stretch bg-background">
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>

      <section className="relative hidden min-h-dvh flex-col border-r bg-sidebar px-12 py-10 lg:flex lg:w-2/5 xl:px-16">
        <div className="flex items-center gap-3 text-sm font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Inbox className="h-4 w-4" /></span> Mail Station</div>
        <div className="my-auto max-w-sm">
          <p className="text-sm text-secondary">Outlook Mail Station</p>
          <h2 className="mt-3 text-2xl font-semibold">Outlook 邮箱管理</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">管理邮箱、收发邮件和维护业务站点。</p>
          <div className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">邮箱管理 · 邮件收发 · 开放接口</div>
        </div>
      </section>

      <div className="relative flex flex-1 flex-col justify-center px-6 py-20 sm:px-12 lg:px-16">
        <div className="mx-auto mb-8 w-full max-w-[380px]">
          <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
            <Inbox className="h-5 w-5" />
          </div>
          <h1 className="text-headline text-2xl">登录</h1>
          <p className="text-paragraph mt-2 text-sm">使用管理员账号登录</p>
        </div>

        <Card className="mx-auto w-full max-w-[380px] border-0 bg-transparent shadow-none"><CardContent className="p-0"><form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                autoComplete="username"
                className="h-10 pl-10"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-10 pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            登录
          </Button>
        </form></CardContent></Card>

      </div>
    </div>
  )
}
