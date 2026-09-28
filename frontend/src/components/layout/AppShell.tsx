import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Info, Inbox, LayoutGrid, LogOut, Mail, Settings2, Users } from 'lucide-react'
import { clearAdminToken } from '@/lib/api'
import type { UserIdentity } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/common/ThemeToggle'

const navItems = [
  { to: '/', label: '邮箱站', icon: Mail, end: true },
  { to: '/accounts', label: '邮箱管理', icon: LayoutGrid },
  { to: '/users', label: '用户', icon: Users },
  { to: '/sites', label: '站点', icon: Settings2 },
  { to: '/about', label: '关于', icon: Info },
]

export function AppShell({ user, children }: { user: UserIdentity | null; children: ReactNode }) {
  const navigate = useNavigate()

  const logout = () => {
    clearAdminToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-canvas flex h-full min-h-screen">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <p className="text-headline text-[15px] leading-tight">Mail Station</p>
            <p className="text-paragraph text-xs">Outlook 邮箱站</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-sidebar-border p-4">
          <div className="rounded-xl bg-card px-3 py-3">
            <p className="text-[11px] text-muted-foreground">当前管理员</p>
            <p className="text-headline truncate text-sm">{user?.username ?? 'admin'}</p>
            <p className="text-paragraph text-xs capitalize">{user?.role ?? 'admin'}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="shrink-0" />
            <Button variant="outline" size="sm" className="flex-1 justify-start" onClick={logout}>
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  )
}
