import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Inbox, Lock, User } from 'lucide-react'
import { login, setAdminToken } from '@/lib/api'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MailIllustration } from '@/components/common/MailIllustration'
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
      toast.success(`欢迎回来，${result.user.username}`)
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

      <section className="relative hidden min-h-dvh flex-col justify-center border-r bg-sidebar px-16 py-16 lg:flex lg:w-1/2 xl:px-24">
        <div className="mb-12 flex items-center gap-3 text-lg font-semibold"><Inbox className="h-6 w-6 text-secondary" /> Mail Station.</div>
        <MailIllustration className="mb-8 w-full max-w-sm" />
        <h2 className="text-4xl font-semibold leading-snug tracking-tight">让邮件井然有序。<br />让工作专注如初。</h2>
        <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">在一个工作空间，管理邮箱池、连接业务站点，轻松处理每一封邮件。</p>
        <div className="mt-10 flex gap-2"><span className="h-1.5 w-8 rounded-full bg-primary" /><span className="h-1.5 w-3 rounded-full bg-secondary/25" /><span className="h-1.5 w-3 rounded-full bg-tertiary" /></div>
      </section>

      <div className="relative flex flex-1 flex-col justify-center px-6 py-20 sm:px-12 lg:px-16">
        <div className="mx-auto mb-8 w-full max-w-[380px]">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-float">
            <Inbox className="h-7 w-7" />
          </div>
          <h1 className="text-headline text-3xl">欢迎回来</h1>
          <p className="text-paragraph mt-2 text-sm leading-relaxed">
            登录 Mail Station，开始管理你的邮件工作空间
          </p>
        </div>

        <Card className="mx-auto w-full max-w-[380px] border-0 bg-transparent shadow-none"><CardContent className="p-0"><form onSubmit={onSubmit} className="space-y-6">
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
            登录后台 <ArrowRight className="h-4 w-4" />
          </Button>
        </form></CardContent></Card>

        <p className="text-paragraph mx-auto mt-8 w-full max-w-[380px] text-xs">
          仅授权管理员可访问邮箱站后台
        </p>
      </div>
    </div>
  )
}
