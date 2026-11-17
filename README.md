# Outlook Mail Station

Outlook Mail Station 是一个面向个人使用的 Outlook 邮箱管理站。

它提供两类核心能力：

- 后台管理：单管理员登录、站点、邮箱池、邮件查看、发信
- 业务开放接口：基于接入密钥的邮箱消费、查信、按站点回退

接口说明见 [docs/API_INTEGRATION.md](./docs/API_INTEGRATION.md)。

仓库地址：https://github.com/why-qw1ko/outlook-mail

## 技术栈

- Python 3.12
- FastAPI
- SQLModel + SQLite
- React + TypeScript + Vite

## 核心模型

### 登录与接入密钥

- 后台仅保留单管理员登录（`OUTLOOK_MAIL_STATION_ADMIN_PASSWORD`）
- 开放接口使用独立「接入密钥」，可多把、可停用、可轮换
- 接入密钥与后台登录身份解耦

### 站点

- 站点由后台维护，使用唯一 `code`
- 邮箱管理中的分组引用站点；导入批次编码 `batch_code` 仍单独保留
- 业务系统消费邮箱时必须带 `site_code`
- 邮箱的消费和回退都按站点维度处理

### 邮箱

- 邮箱存放在全局邮箱池
- 在「邮箱管理」导入和维护全部邮箱；在列表打开「邮箱站」开关后，启用的邮箱会出现在邮箱站。新导入邮箱默认不显示，已有数据库升级后保持原有显示状态。
- 「业务状态」独立控制邮箱能否被开放接口使用；停用会释放该邮箱的全部站点占用。
- 站点占用记录业务站点领取过哪些邮箱：同一站点不会重复领取尚未释放的邮箱，不同站点可以使用同一个邮箱。站点分组仅用于整理筛选，不产生占用。占用用于分配记录，不隔离访问权限；接入密钥仍可访问所有启用邮箱。
- 邮箱可以同步收件箱、垃圾箱、发件箱
- 删除邮箱为硬删除：账号、邮件缓存与站点占用一并清理

## 权限模型

### 后台管理接口

- 后台页面和管理接口使用管理员 Bearer Token
- 用于站点管理、邮箱导入、邮箱池维护、接入密钥管理

### 业务开放接口

- 业务开放接口使用接入密钥（`X-API-Key` 或 `Authorization: Bearer`）
- 可访问全局邮箱池中的启用邮箱

## 当前开放接口

业务开放接口统一挂在 `/api/open/*`：

- `POST /api/open/random-email`
- `GET /api/open/mailboxes/{email}/latest`
- `GET /api/open/mailboxes/{email}/messages`
- `POST /api/open/mailboxes/{email}/sites/{site_code}/release`

## 快速开始

### 1. 准备环境

```bash
cp .env.example .env
uv sync
```

至少需要配置：

- `OUTLOOK_MAIL_STATION_ADMIN_PASSWORD`
- `OUTLOOK_MAIL_STATION_ADMIN_JWT_SECRET`

### 2. 启动后端

```bash
uv run python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8015
```

Windows 也可以直接使用：

```powershell
.\start_backend.ps1
```

或：

```bat
start_backend.bat
```

后端地址：

```text
http://localhost:8015
```

### 3. 启动前端开发服务器

```bash
cd frontend
npm install
npm run dev
```

前端开发地址：

```text
http://localhost:5174
```

### 4. 构建前端

```bash
cd frontend
npm install
npm run build
```

构建产物输出到：

```text
./backend/static
```

构建完成后，直接访问后端地址即可使用完整站点。

## 后台能力

- 管理员登录
- 接入密钥管理（创建 / 停用 / 轮换 / 删除）
- 站点管理
- 邮箱导入
- 邮箱池查询、筛选、导出
- 随机消费 / 手动消费 / 按站点回退
- 邮件同步与查看
- SMTP 发信
- 邮箱硬删除（连同邮件缓存与站点占用）

## 导入格式

后台导入接口支持文本和 JSON 两种格式。

### 文本格式

```text
example@outlook.com----password
example@outlook.com----client_id----refresh_token
example@outlook.com----password----client_id----refresh_token
```

重复导入已有邮箱时，仅更新本次提供的密码或完整 OAuth 凭据，保留原有启用状态、批次、分组和邮箱站开关。只提供密码的邮箱无法使用 Outlook 的现代认证收发邮件；可在邮箱管理中点击「验证连接」验证 OAuth 和 IMAP。令牌状态“已配置（未验证）”只表示字段存在。

为减少密码暴露，后台邮箱列表和详情接口不再返回密码值；管理员主动复制或导出时仍会取得密码。依赖旧列表接口 `password` 字段的自定义客户端需要调整。

### JSON 格式

```json
[
  {
    "email": "example@outlook.com",
    "password": "password",
    "clientId": "xxxx",
    "refreshToken": "xxxx"
  }
]
```

## 业务开放接口使用方式

调用 `/api/open/*` 时，使用后台创建的接入密钥：

```http
X-API-Key: your-api-key
```

或：

```http
Authorization: Bearer your-api-key
```

业务系统调用流程通常是：

1. 用 `/api/open/random-email` 按站点领取邮箱
2. 用 `/api/open/mailboxes/{email}/latest` 或 `/messages` 获取邮件
3. 业务结束后，用 `/api/open/mailboxes/{email}/sites/{site_code}/release` 回退该站点占用

## 邮件同步策略

- 开放接口默认按需同步
- 收件相关接口优先同步 `inbox + junk`
- 同一邮箱在冷却时间内优先使用缓存
- 已被站点占用的活跃邮箱会进行后台轻量预热同步

相关配置：

```env
OUTLOOK_MAIL_STATION_OPEN_API_SYNC_COOLDOWN_SECONDS=60
OUTLOOK_MAIL_STATION_ACTIVE_MAILBOX_SYNC_INTERVAL_SECONDS=5
OUTLOOK_MAIL_STATION_ACTIVE_MAILBOX_SYNC_STALE_SECONDS=8
OUTLOOK_MAIL_STATION_ACTIVE_MAILBOX_SYNC_LIMIT=30
```

## Docker 部署

### 本地构建运行

```bash
docker compose up -d --build
```

默认访问地址：

```text
http://localhost:8015
```

### 数据持久化

当前默认挂载目录：

```text
./data:/app/data
```

数据库默认位于：

```text
./data/outlook_mail_station.db
```

升级前请备份数据库。启动时会为旧数据库补充邮箱站显示字段，已有邮箱保持显示；邮箱密码和 OAuth 刷新令牌目前仍保存在数据库中，应保护数据库和备份文件的访问权限。

### GHCR 部署

仓库默认镜像：

```text
ghcr.io/why-qw1ko/outlook-mail
```

完整部署说明见 [docs/GHCR_DEPLOY.md](./docs/GHCR_DEPLOY.md)。

## 项目文档

- [API 对接文档](./docs/API_INTEGRATION.md)
- [GHCR 部署文档](./docs/GHCR_DEPLOY.md)
