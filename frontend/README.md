# 前端组件与主题

前端采用 React 19、Tailwind CSS 3、shadcn/ui New York 与 Radix UI。
组件源码位于 `src/components/ui`，注册表配置为 `components.json`。
Dialog、DropdownMenu、Label、Separator、Card、Badge、Table、Textarea 来自
[shadcn 官方注册表](https://ui.shadcn.com/r/styles/new-york/dialog.json)，并按本项目主题调整。
Button 保留业务所需的 `loading`、`icon-sm`，增加 Radix Slot 的 `asChild` 支持。
`common/AppDialog.tsx` 将原有业务弹窗接口组合到标准 Dialog 上。
Select 保留原生 `<select>`，维持现有 `onChange`、表单及移动端系统选择器行为。

## 修改主题

`src/index.css` 的 `:root` / `.dark` 是主题颜色来源；
`tailwind.config.ts` 将这些变量映射到 Tailwind 类名。

| 用途 | 浅色值 | 变量 |
| --- | --- | --- |
| 背景 | `#FFFFFF` | `--background` |
| 标题 / 按钮文字 | `#1f1235` | `--foreground` / `--primary-foreground` |
| 副标题 | `#1b1425` | `--subheading` |
| 主按钮 / 插画高亮 | `#ff6e6c` | `--primary` |
| 辅助紫色 | `#67568c` | `--secondary` |
| 辅助黄色 | `#fbdd74` | `--tertiary` |

可在 [tweakcn](https://tweakcn.com/) 调整 shadcn 主题，再将对应颜色转换为
本项目的 Tailwind 3 HSL 通道格式（例如 `--background: 0 0% 100%;`）。
不要直接覆盖为 Tailwind 4 的 `@theme` 或 `oklch(...)` 格式：本项目用
`hsl(var(--background))` 消费变量。保留 `subheading`、`tertiary`、`success`、
`success-surface`、`app-bg`、`glass` 等扩展变量，并同步检查深色主题。
圆角由 `--radius` 控制。无需把项目代码、邮箱或账号数据上传到调色工具。

新增组件可在本目录使用 shadcn CLI；更新已有组件时先检查 diff，保留业务扩展。

## 验证

```sh
npm run build
npm audit --omit=dev --registry=https://registry.npmjs.org
```

视觉检查覆盖桌面三栏、390px 窄屏分栏、移动导航、深浅主题、表格横向滚动、
弹窗的焦点约束与 Escape 关闭。管理接口不可用时，示例数据的视觉验证不能
替代真实登录、导入、同步、收发邮件与分享的端到端验证。
