import { Github } from 'lucide-react'
import { Button } from '@/components/ui/button'

const GITHUB_URL = 'https://github.com/why-qw1ko/outlook-mail'

export function AboutPage() {
  return (
    <div className="scroll-area min-h-0 flex-1">
      <header className="page-header block">
        <h1 className="text-headline">关于</h1>
      </header>

      <div className="max-w-3xl space-y-4 p-4 sm:p-6">
        <section className="surface p-5">
          <h2 className="text-headline text-base">Outlook Mail Station</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            用于管理 Outlook 邮箱、收发邮件及向业务系统提供邮箱接口。
          </p>
          <dl className="mt-5 grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
            <div><dt className="font-medium">邮箱管理</dt><dd className="mt-1 text-muted-foreground">导入、分组和维护邮箱</dd></div>
            <div><dt className="font-medium">邮箱站</dt><dd className="mt-1 text-muted-foreground">同步和查看邮件</dd></div>
            <div><dt className="font-medium">开放接口</dt><dd className="mt-1 text-muted-foreground">按站点领取和释放邮箱</dd></div>
          </dl>
        </section>

        <section className="surface flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-headline text-sm">开源仓库</h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{GITHUB_URL}</p>
          </div>
          <Button variant="outline" onClick={() => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')}>
            <Github className="h-4 w-4" />
            访问 GitHub
          </Button>
        </section>
      </div>
    </div>
  )
}
