# 本地开发快速启动（LOCAL_DEV）

本文档记录一键在本地启动项目的步骤、常见问题与排查命令，目的是避免重复出现初始化和环境变量不一致等问题。

前提
- 已安装 Docker、Docker Compose、Node.js（>=20）、pnpm
- 仓库根存在 `.env` 且已填写关键变量：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`（>=32 字符、高熵）、`FRONTEND_URL`、`ADMIN_INIT_*`

快速一键启动
1. 拉取依赖（只需第一次或变更依赖时）：
```bash
pnpm install
```

2. 一键启动基础服务与三进程（在仓库根运行）：
```bash
# 启动数据库、Redis、Qdrant（后台）并启动 api/worker/web（会在前台输出日志）
pnpm run dev:all
```

单步启动（更可控）
```bash
# 启动基础容器
docker compose up -d postgres redis qdrant

# 确认 Postgres / Qdrant
docker compose ps
docker compose logs -f postgres
curl -sS http://localhost:6333/health

# 加载 .env 并分别在不同终端运行以下命令：
set -o allexport; [ -f .env ] && source .env; set +o allexport
pnpm --filter @collab/api dev
pnpm --filter @collab/worker dev
pnpm --filter @collab/web dev
```

重要注意事项与排查
- JWT_SECRET：必须 >=32 字符且高熵。推荐生成命令：`openssl rand -hex 32`。API 启动会校验熵与弱模式。
- 数据库认证失败：常见原因是容器内部的 `admin` 密码与 `.env` 中不一致。
  - 检查容器内环境：`docker compose exec postgres printenv | egrep "POSTGRES|DB|PASSWORD|USER"`
  - 在容器内重设密码（示例）：
    ```bash
    docker compose exec postgres bash -lc "psql -U admin -d postgres -c \"ALTER USER admin WITH PASSWORD '$DB_PASSWORD';\""
    ```
  - 从宿主验证连接（临时 postgres 容器）：
    ```bash
    docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:16 \
      psql -h host.docker.internal -U admin -d collab_comments -c "SELECT 1;"
    ```
- 如果宿主没有 `psql`，可使用上面临时容器方法。
- Qdrant 问题：查看 worker/API 日志是否有 `Qdrant initialized` 或 `Stored embedding` 日志。
- SSE：服务已设连接上限和心跳保护，若需要更高并发，请调整 `packages/api/src/routes/comment.ts` 的 `MAX_CONNECTIONS_PER_DOCUMENT`。

开发辅助命令
- 查看 API 健康：`curl http://localhost:3000/health`
- 查询初始管理员（示例）：
```bash
docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:16 \
  psql -h host.docker.internal -U admin -d collab_comments \
  -c "SELECT email,is_admin,email_verified FROM users WHERE email='admin@reading.local';"
```

建议
- 将常用排查命令保存到 `LOCAL_DEV.md`（已添加）。
- 若希望更安全的 dev 脚本，可使用 `concurrently` 或 `tmux` 管理多个前台进程。

---
更新时间：2026-03-12
