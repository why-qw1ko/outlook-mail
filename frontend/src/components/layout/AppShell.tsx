import { useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Info, Inbox, LayoutGrid, LogOut, Mail, Menu, Settings2, Users } from 'lucide-react'
import { clearAdminToken } from '@/lib/api'
import type { UserIdentity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/common/ThemeToggle'

const navItems = [
  { to: '/', label: '邮箱站', icon: Mail, end: true },
  { to: '/accounts', label: '邮箱管理', icon: LayoutGrid },
  { to: '/users', label: '用户', icon: Users },
  { to: '/sites', label: '站点', icon: Settings2 },
  { to: '/about', label: '关于', icon: Info },
]

export function AppShell({ user, children }: { user: UserIdentity | null; children: ReactNode }) {
  const menuButton = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentPage = navItems.find((item) => item.to === location.pathname)
  const logout = () => {
    clearAdminToken()
    navigate('/login', { replace: true })
  }

  const navigation = (
    <>
      <div className="flex items-center gap-3 px-5 py-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Inbox className="h-5 w-5" />
        </div>
        <div>
          <p className="text-headline text-base">Mail Station<span className="text-primary">.</span></p>
          <p className="mt-0.5 text-[11px] tracking-wide text-muted-foreground">OUTLOOK 工作空间</p>
        </div>
      </div>
      <div className="px-6 pb-3 pt-3 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">工作台 / WORKSPACE</div>
      <nav aria-label="主导航" className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn('group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-ring', isActive ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground')}>
            {({ isActive }) => <>
              <item.icon className={cn('h-[18px] w-[18px]', isActive && 'text-secondary')} />
              {item.label}
              {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" /> : null}
            </>}
          </NavLink>
        ))}
      </nav>
      <div className="m-4 rounded-xl border border-secondary/10 bg-secondary/5 p-4">
        <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-tertiary text-tertiary-foreground"><Mail className="h-4 w-4" /></div>
        <p className="text-sm font-medium">让邮件井然有序</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">账号、站点与邮件，集中管理。</p>
      </div>
      <Separator />
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">{(user?.username || 'A').slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.username ?? 'admin'}</p>
          <p className="text-[11px] text-muted-foreground">{user?.role === 'user' ? '用户' : '管理员'}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={logout} aria-label="退出登录" title="退出登录"><LogOut className="h-4 w-4" /></Button>
      </div>
    </>
  )

  return (
    <div className="app-canvas flex h-dvh min-h-0 overflow-hidden">
      <a href="#main-content" className="sr-only z-[100] rounded-md bg-card p-3 focus:not-sr-only focus:absolute">跳到主要内容</a>
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">{navigation}</aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); (event.target as HTMLElement).querySelector<HTMLAnchorElement>('nav a')?.focus() }} onCloseAutoFocus={(event) => { event.preventDefault(); menuButton.current?.focus() }} className="left-0 top-0 flex h-dvh w-[min(290px,85vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-l-0 bg-sidebar p-0 sm:rounded-none data-[state=open]:slide-in-from-left data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left data-[state=closed]:slide-out-to-top-0">
          <DialogTitle className="sr-only">导航菜单</DialogTitle>
          <DialogDescription className="sr-only">切换工作台页面或退出登录</DialogDescription>
          {navigation}
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-7">
          <Button ref={menuButton} variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="打开导航菜单"><Menu className="h-5 w-5" /></Button>
          <span className="hidden text-xs text-muted-foreground sm:inline">工作空间</span>
          <ChevronRight className="hidden h-3 w-3 text-muted-foreground sm:block" />
          <span className="text-xs font-medium">{currentPage?.label ?? 'Mail Station'}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">OUTLOOK MAIL STATION</span>
            <ThemeToggle />
          </div>
        </div>
        <main id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">{children}</main>
      </div>
    </div>
  )
}
