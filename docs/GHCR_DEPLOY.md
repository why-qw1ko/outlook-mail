# GHCR 部署与启动

本文档用于从 `ghcr.io` 拉取镜像并启动 Outlook Mail Station。

## 1. 镜像地址

当前仓库默认发布到：

```text
ghcr.io/why-qw1ko/outlook-mail
```

默认分支 `main` 推送成功后，会更新：

```text
:latest
:main
:sha-<commit>
```

打 `v*` tag 时，还会额外发布对应版本 tag。

## 2. 服务器准备

最少需要准备：

1. Docker Engine + Docker Compose
2. `.env`
3. 数据目录 `./data`

建议目录结构：

```text
outlook-mail/
├── .env
├── docker-compose.ghcr.yml
└── data/
```

## 3. 从拉取到部署完成

当前 GHCR 镜像是公开的，不需要执行 `docker login`。

### 推荐：一键部署

Linux / macOS：

```bash
chmod +x deploy_ghcr.sh
./deploy_ghcr.sh
```

Windows PowerShell：

```powershell
.\deploy_ghcr.ps1
```

### 手动部署

1. 准备 `.env`（至少配置管理员密码和 JWT Secret）
2. 创建数据目录 `./data`
3. 拉取镜像并启动：

```bash
docker pull ghcr.io/why-qw1ko/outlook-mail:latest
docker compose -f docker-compose.ghcr.yml up -d
```

或指定版本：

```bash
docker pull ghcr.io/why-qw1ko/outlook-mail:v1.0.0
```

## 4. 常用命令

```bash
# 查看日志
docker logs -f outlook-mail

# 重启
docker restart outlook-mail

# 停止
docker compose -f docker-compose.ghcr.yml down
```

## 5. 环境变量

自定义镜像地址时：

```bash
export OUTLOOK_MAIL_STATION_IMAGE=ghcr.io/why-qw1ko/outlook-mail:latest
```

Windows PowerShell：

```powershell
$env:OUTLOOK_MAIL_STATION_IMAGE = "ghcr.io/why-qw1ko/outlook-mail:latest"
```

其他必要配置见仓库根目录 `.env.example`。

## 6. 访问

默认端口 `8015`：

```text
http://localhost:8015
```

完整 API 说明见 [API_INTEGRATION.md](./API_INTEGRATION.md)。
