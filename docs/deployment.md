# 部署文档

本文件说明生产环境的最小部署流程。

## 1. 准备

- 已安装 Docker 与 Docker Compose
- 根目录存在 `docker-compose.prod.yml`
- 准备生产环境变量文件 `.env.production`

初始化配置：

```bash
cp .env.production.example .env.production
```

至少检查以下变量：

- DB_PASSWORD
- REDIS_PASSWORD
- JWT_SECRET
- FRONTEND_URL
- ADMIN_INIT_EMAIL / ADMIN_INIT_USERNAME / ADMIN_INIT_PASSWORD
- ADMIN_EMAILS
- SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM

## 2. 推荐部署方式（脚本）

```bash
./deploy.sh up
```

常用命令：

```bash
./deploy.sh status
./deploy.sh logs
./deploy.sh restart
./deploy.sh rebuild
./deploy.sh down
./deploy.sh db-backup
```

## 3. 直接 compose 部署（可选）

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 4. 部署后验证

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost/ || true
curl http://localhost:3000/health || true
```

在浏览器确认：

- Web 可访问
- API 文档可访问（/api-docs）
- 登录与文档列表可用

## 5. 回滚与恢复

### 快速停止

```bash
./deploy.sh down
```

### 数据备份

```bash
./deploy.sh db-backup
```

说明：生产 HTTPS 证书与自动续期策略需按实际域名环境单独配置。

更新时间：2026-03-14
