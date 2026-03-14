# 本地开发指南

本文档聚焦本地开发启动、环境检查和常见问题排查。

## 前置要求

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose
- 根目录存在 .env，并正确配置：DATABASE_URL、REDIS_URL、QDRANT_URL、JWT_SECRET、FRONTEND_URL

## 推荐启动方式

```bash
pnpm install
pnpm run dev:all
```

说明：
- dev:all 会先启动 postgres/redis/qdrant，再拉起 API、Worker、Web。
- 如果你希望分开查看日志，请改用手动方式。

## 手动启动方式

```bash
# 基础设施
docker compose up -d postgres redis qdrant

# 服务进程（建议分 3 个终端）
pnpm --filter @collab/api dev
pnpm --filter @collab/worker dev
pnpm --filter @collab/web dev
```

## 健康检查

```bash
curl http://localhost:3000/health
curl http://localhost:6333/health
docker compose ps
```

## 常见问题

### 1) 数据库连接失败

排查：

```bash
docker compose logs -f postgres
docker compose exec postgres printenv | egrep "POSTGRES|DB|PASSWORD|USER"
```

必要时重置数据库用户密码：

```bash
docker compose exec postgres bash -lc "psql -U admin -d postgres -c \"ALTER USER admin WITH PASSWORD '$DB_PASSWORD';\""
```

### 2) JWT_SECRET 不合法

- 建议至少 32 字符且高熵。
- 生成示例：

```bash
openssl rand -hex 32
```

### 3) Qdrant 相关异常

检查：

```bash
docker compose logs -f qdrant
```

再查看 API/Worker 日志中是否出现初始化和写入信息。

### 4) 评论 SSE 异常

先确认 API 正常，再检查反向代理配置和连接数限制。

## 开发建议

- 本地调试优先用手动启动，便于分服务定位问题。
- 端到端联调优先用 dev:all，降低启动成本。

更新时间：2026-03-14
