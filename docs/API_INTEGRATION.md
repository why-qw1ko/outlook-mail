# Outlook Mail Station API Integration

本文档描述当前系统实际可用的接口能力、认证方式和数据权限规则。

## 1. 接口分层

系统接口分为两类：

### 后台管理接口

- 路径前缀：`/api/*`
- 认证方式：管理员 Bearer Token
- 作用：后台页面、站点管理、邮箱池维护、接入密钥管理

### 业务开放接口

- 路径前缀：`/api/open/*`
- 认证方式：接入密钥
- 作用：业务系统领取邮箱、查信、按站点回退

## 2. 业务开放接口认证

开放接口支持两种传参方式：

### 方式 A

```http
X-API-Key: your-api-key
```

### 方式 B

```http
Authorization: Bearer your-api-key
```

接入密钥在后台「接入密钥」页创建，可多把、可停用、可轮换。

## 3. 数据权限规则

业务开放接口遵循以下规则：

- 接入密钥可访问全局邮箱池中的启用邮箱
- 邮箱查询与站点回退都必须命中该邮箱池中的邮箱
- 释放站点占用时校验占用记录存在

## 4. 业务模型

### 邮箱池

- 邮箱统一放在全局邮箱池
- 删除邮箱为硬删除，会清理邮件缓存与站点占用

### 站点占用

- 业务系统消费邮箱时必须带 `site_code`
- 同一个邮箱不能被同一个站点重复占用
- 一个邮箱可以被多个不同站点分别占用
- 回退必须带 `site_code`

## 5. 业务开放接口一览

### 5.1 随机消费邮箱

```http
POST /api/open/random-email
Content-Type: application/json
```

请求体：

```json
{
  "site_code": "OPENAI",
  "batch_code": "batch-20260405",
  "domain": "outlook.com"
}
```

字段说明：

- `site_code`：必填，站点编码
- `batch_code`：可选，批次过滤
- `domain`：可选，邮箱域名过滤

响应示例：

```json
{
  "id": 1,
  "email": "demo@outlook.com",
  "domain": "outlook.com",
  "site_code": "OPENAI",
  "site_name": "OpenAI",
  "batch_code": "batch-20260405"
}
```

### 5.2 获取最新一封收件

```http
GET /api/open/mailboxes/{email}/latest?refresh=true
```

查询参数：

- `refresh`：可选，默认 `true`

响应示例：

```json
{
  "account_id": 1,
  "email": "demo@outlook.com",
  "message": {
    "id": 101,
    "folder": "inbox",
    "subject": "Your OpenAI code is 853703",
    "sender_name": "",
    "sender_email": "noreply@tm.openai.com",
    "recipient_summary": "demo@outlook.com",
    "preview": "Your OpenAI code is 853703 ...",
    "sent_at": "2026-04-05T08:11:22Z",
    "body_text": "Your OpenAI code is 853703",
    "body_html": "<p>Your OpenAI code is 853703</p>"
  }
}
```

### 5.3 获取邮件列表

```http
GET /api/open/mailboxes/{email}/messages?refresh=true&folder=inbox&since=2026-04-05T00:00:00+08:00
```

查询参数：

- `refresh`：可选，默认 `true`
- `folder`：可选，默认 `inbox`
- `since`：可选，ISO8601 时间

返回规则：

- `folder=inbox` 时返回 `inbox + junk`
- `folder=sent` 时返回发件箱缓存

响应示例：

```json
{
  "account_id": 1,
  "email": "demo@outlook.com",
  "count": 2,
  "items": [
    {
      "id": 101,
      "folder": "inbox",
      "subject": "Your OpenAI code is 853703",
      "sender_name": "",
      "sender_email": "noreply@tm.openai.com",
      "recipient_summary": "demo@outlook.com",
      "preview": "Your OpenAI code is 853703 ...",
      "sent_at": "2026-04-05T08:11:22Z"
    }
  ]
}
```

### 5.4 按站点回退邮箱占用

```http
POST /api/open/mailboxes/{email}/sites/{site_code}/release
```

响应示例：

```json
{
  "ok": true,
  "email": "demo@outlook.com",
  "message": "邮箱已从站点 OpenAI 退回"
}
```

## 6. 后台管理相关接口

以下接口主要供后台页面使用，认证方式为管理员 Bearer Token：

- `GET /api/admin/auth/status`
- `POST /api/admin/auth/login`
- `GET /api/api-keys`
- `POST /api/api-keys`
- `PATCH /api/api-keys/{key_id}`
- `POST /api/api-keys/{key_id}/regenerate`
- `DELETE /api/api-keys/{key_id}`
- `GET /api/sites`
- `POST /api/sites`
- `PATCH /api/sites/{site_id}`
- `DELETE /api/sites/{site_id}`
- `POST /api/accounts/import`
- `GET /api/accounts`
- `GET /api/accounts/export`
- `POST /api/accounts/batch-update`
- `POST /api/accounts/batch-delete`
- `POST /api/accounts/random-consume`
- `GET /api/accounts/pool-summary`
- `GET /api/accounts/{account_id}`
- `PATCH /api/accounts/{account_id}`
- `POST /api/accounts/{account_id}/consume`
- `POST /api/accounts/{account_id}/release`
- `DELETE /api/accounts/{account_id}`
- `POST /api/accounts/{account_id}/sync`
- `GET /api/accounts/{account_id}/messages`
- `GET /api/messages/{message_id}`
- `POST /api/accounts/{account_id}/send`

## 7. 邮件同步说明

- 开放接口默认按需同步
- 收件相关查询优先同步 `inbox + junk`
- 同一个邮箱在冷却时间内优先复用缓存
- 被站点占用的活跃邮箱会参与后台预热同步

相关配置：

```env
OUTLOOK_MAIL_STATION_OPEN_API_SYNC_COOLDOWN_SECONDS=60
OUTLOOK_MAIL_STATION_ACTIVE_MAILBOX_SYNC_INTERVAL_SECONDS=5
OUTLOOK_MAIL_STATION_ACTIVE_MAILBOX_SYNC_STALE_SECONDS=8
OUTLOOK_MAIL_STATION_ACTIVE_MAILBOX_SYNC_LIMIT=30
```

## 8. 常见错误

未提供接入密钥：

```json
{
  "detail": "未提供开放接口接入密钥"
}
```

接入密钥校验失败：

```json
{
  "detail": "开放接口认证失败"
}
```

邮箱不存在：

```json
{
  "detail": "邮箱不存在"
}
```

当前站点无可用邮箱：

```json
{
  "detail": "没有可分配给当前站点的邮箱"
}
```

当前站点占用记录不存在：

```json
{
  "detail": "当前邮箱不存在对应站点的有效使用记录"
}
```

## 9. cURL 示例

### 9.1 随机消费邮箱

```bash
curl -X POST "http://localhost:8015/api/open/random-email" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d "{\"site_code\":\"OPENAI\",\"domain\":\"outlook.com\",\"batch_code\":\"batch-20260405\"}"
```

### 9.2 获取最新收件

```bash
curl "http://localhost:8015/api/open/mailboxes/demo@outlook.com/latest?refresh=true" \
  -H "X-API-Key: your-api-key"
```

### 9.3 获取邮件列表

```bash
curl "http://localhost:8015/api/open/mailboxes/demo@outlook.com/messages?refresh=true&folder=inbox&since=2026-04-05T00:00:00+08:00" \
  -H "X-API-Key: your-api-key"
```

### 9.4 按站点回退邮箱

```bash
curl -X POST "http://localhost:8015/api/open/mailboxes/demo@outlook.com/sites/OPENAI/release" \
  -H "X-API-Key: your-api-key"
```
