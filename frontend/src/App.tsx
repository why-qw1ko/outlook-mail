import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { fetchAuthStatus, getAdminToken } from '@/lib/api'
import type { UserIdentity } from '@/lib/types'
import { ThemeProvider } from '@/lib/theme'
import { ToastProvider } from '@/components/ui/toast'
import { LoadingState } from '@/components/common/states'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { StationPage } from '@/pages/StationPage'
import { AccountsManagePage } from '@/pages/AccountsManagePage'
import { UsersPage } from '@/pages/UsersPage'
import { SitesPage } from '@/pages/SitesPage'
import { AboutPage } from '@/pages/AboutPage'
import { PublicSharePage } from '@/pages/PublicSharePage'

function ProtectedRoutes() {
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null)
  const [user, setUser] = useState<UserIdentity | null>(null)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    fetchAuthStatus()
      .then((status) => {
        if (cancelled) return
        setAuthEnabled(status.enabled)
        setUser(status.user)
      })
      .catch(() => {
        if (!cancelled) setAuthEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (authEnabled === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingState label="正在启动 Mail Station…" />
      </div>
    )
  }

  if (authEnabled && !getAdminToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <AppShell user={user}>
      <Routes>
        <Route path="/" element={<StationPage />} />
        <Route path="/accounts" element={<AccountsManagePage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/share/:token" element={<PublicSharePage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
