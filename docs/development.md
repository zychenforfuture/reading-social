# 开发文档

本文件是本地开发的最小闭环说明。

## 1. 环境要求

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose
- 根目录 .env 已配置：DATABASE_URL、REDIS_URL、QDRANT_URL、JWT_SECRET、FRONTEND_URL

## 2. 推荐启动

```bash
pnpm install
pnpm run dev:all
```

说明：`dev:all` 会启动 postgres、redis、qdrant，并拉起 API、Worker、Web。

## 3. 手动启动（排障用）

```bash
docker compose up -d postgres redis qdrant
pnpm --filter @collab/api dev
pnpm --filter @collab/worker dev
pnpm --filter @collab/web dev
```

## 4. 健康检查

```bash
curl http://localhost:3000/health
curl http://localhost:6333/health
docker compose ps
```

## 5. 常见问题

### 数据库连接失败

```bash
docker compose logs -f postgres
docker compose exec postgres printenv | egrep "POSTGRES|DB|PASSWORD|USER"
```

重置用户密码：

```bash
docker compose exec postgres bash -lc "psql -U admin -d postgres -c \"ALTER USER admin WITH PASSWORD '$DB_PASSWORD';\""
```

### JWT_SECRET 太弱或不合法

```bash
openssl rand -hex 32
```

### Qdrant 异常

```bash
docker compose logs -f qdrant
```

### SSE 异常

先确认 API 健康，再检查反向代理和连接数限制。

## 6. 开发建议

- 联调优先用 `pnpm run dev:all`。
- 精细排障优先用手动启动分服务查看日志。

更新时间：2026-03-14
