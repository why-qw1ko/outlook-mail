import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Lock, User } from 'lucide-react'
import { login, setAdminToken } from '@/lib/api'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
      toast.success(`欢迎回来，${result.user.username}`)
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-canvas relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 420px at 15% 10%, hsl(var(--primary) / 0.16), transparent 60%), radial-gradient(700px 360px at 85% 85%, hsl(var(--secondary) / 0.2), transparent 55%)',
        }}
      />

      <div className="relative w-full max-w-[420px] animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-float">
            <Inbox className="h-7 w-7" />
          </div>
          <h1 className="text-headline text-2xl">Outlook Mail Station</h1>
          <p className="text-paragraph mt-2 text-sm leading-relaxed">
            管理邮箱池、站点占用与邮件收发
          </p>
        </div>

        <form onSubmit={onSubmit} className="surface animate-slide-up space-y-5 p-7">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                autoComplete="username"
                className="pl-10"
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
                className="pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            登录后台
          </Button>
        </form>

        <p className="text-paragraph mt-6 text-center text-xs">
          仅授权管理员可访问邮箱站后台
        </p>
      </div>
    </div>
  )
}
