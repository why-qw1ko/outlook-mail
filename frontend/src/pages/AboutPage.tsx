import { Github, Info, Mail, ShieldCheck, Table2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

const GITHUB_URL = 'https://github.com/why-qw1ko/outlook-mail'

export function AboutPage() {
  return (
    <div className="scroll-area min-h-0 flex-1">
      <header className="glass-bar border-b border-border px-5 py-4">
        <h1 className="text-headline text-lg leading-tight">关于</h1>
        <p className="text-paragraph text-xs">Outlook Mail Station 介绍与开源地址</p>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <section className="surface animate-fade-in p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-headline text-xl">Outlook Mail Station</h2>
              <p className="text-paragraph mt-2 text-sm leading-relaxed">
                面向账号池管理与业务对接的 Outlook 邮件站。支持后台用户与站点维护、
                邮箱导入导出、邮件收发与手动同步、公开只读分享，以及基于用户级 API Key
                的业务开放接口。
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Table2,
              title: '邮箱管理',
              desc: '表格检索、分组筛选、批量复制与导入导出',
            },
            {
              icon: Mail,
              title: '邮件工作台',
              desc: '三栏收发信，卡片快捷获取新邮件',
            },
            {
              icon: ShieldCheck,
              title: '开放接口',
              desc: 'API Key 绑定用户池，按站点占用与回退',
            },
          ].map((item) => (
            <div key={item.title} className="surface p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                <item.icon className="h-4 w-4" />
              </div>
              <h3 className="text-headline mt-3 text-[15px]">{item.title}</h3>
              <p className="text-paragraph mt-2 text-[13px] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="surface p-6">
          <h2 className="text-headline text-base">能力一览</h2>
          <ul className="text-paragraph mt-3 space-y-2 text-sm leading-relaxed">
            <li className="flex gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              用户与邮箱池管理、API Key 查看与重置
            </li>
            <li className="flex gap-2">
              <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              邮箱表格：搜索、分组筛选、批量复制/改分组/删除、txt 导出
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              手动获取邮件（无倒计时轮询）、写信、公开分享链接
            </li>
          </ul>
        </section>

        <section className="surface flex flex-wrap items-center gap-4 p-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-headline text-base">开源仓库</h2>
            <p className="text-paragraph mt-2 break-all text-sm">{GITHUB_URL}</p>
          </div>
          <Button onClick={() => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')}>
            <Github className="h-4 w-4" />
            打开 GitHub
          </Button>
        </section>

        <p className="text-paragraph pb-4 text-center text-xs">
          设计参考 Apple Human Interface Guidelines · 主题支持浅色/深色切换
        </p>
      </div>
    </div>
  )
}
