# 测试指南（packages/api）

目的：为测试专员集中列出启动、运行与调试 API 测试的常用命令、必要环境变量和辅助脚本路径，便于管理与复现。

**快速目录**
- 运行测试：`pnpm --filter @collab/api test`
- 环境验证脚本：`packages/api/src/scripts/validate-env.ts`
- 本地 DB 辅助脚本：`create-admin.ts`, `test-db.js`（仓库根或 `packages/api` 下）

**准备（推荐使用 Docker）**
1. 使用仓库提供的一键脚本（推荐）或直接使用 docker-compose：

```bash
# 推荐：通过项目提供的脚本启动测试（会自动启动依赖、初始化 DB 并运行测试）
pnpm --filter @collab/api run test:local

# 或直接：在仓库根运行 docker-compose.test.yml
docker compose -f docker-compose.test.yml up -d
```

2. 验证环境变量：

```bash
pnpm --filter @collab/api tsx src/scripts/validate-env.ts
```

必需环境变量（测试/本地）示例：
- `DATABASE_URL` — e.g. `postgres://admin:admin@localhost:5432/collab_comments_test`
- `REDIS_URL` — e.g. `redis://localhost:6379`
- `JWT_SECRET` — 测试可使用较短值，但 CI/生产需 >=32 字符
- `FRONTEND_URL` — 用于生成邮件链接（测试可设为 `http://localhost:5173`）

可选但推荐：
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — 若未配置，邮件发送会被跳过（记录日志）。

**常用脚本 & 文件**
- 环境检查：[packages/api/src/scripts/validate-env.ts](packages/api/src/scripts/validate-env.ts#L1)
- 邮件工具（已支持 no-op）：[packages/api/src/utils/email.ts](packages/api/src/utils/email.ts#L1)
- DB 初始化：`docker/postgres/init.sql`（CI/服务启动时被执行）
- 测试入口：`packages/api/src/__tests__/` 下为各模块测试套件（按功能组织）

**运行单个测试文件**
```bash
pnpm --filter @collab/api vitest run packages/api/src/__tests__/comment.test.ts
```

**本地一键运行（等同于上面的 `test:local`）**

项目根包含脚本 `scripts/test.sh`，会：
- 启动 `docker-compose.test.yml` 中的 Postgres/Redis/Qdrant 服务
- 应用 `docker/postgres/init.sql` 初始化表和扩展
- 设置测试环境变量（`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` 等）
- 运行 `pnpm --filter @collab/api test`

直接执行脚本：

```bash
./scripts/test.sh
```

**调试建议**
- 若遇到 `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`：检查 `DATABASE_URL` 中的用户名/密码是否为字符串且格式正确。
- 若遇到 `NOAUTH Authentication required`：检查 `REDIS_URL`（是否包含密码）或本地 Redis 是否需要认证。
- 若测试依赖 pgvector/扩展且本地镜像不含扩展：考虑使用仓库推荐的自定义 Postgres 镜像或在 CI 中使用带扩展的镜像。

**为测试专员准备的常用命令**

启动依赖服务：

```bash
docker-compose up -d postgres redis
```

运行全部测试：

```bash
pnpm --filter @collab/api test
```

运行带 watch 的本地调试：

```bash
pnpm --filter @collab/api vitest --watch
```

验证并初始化管理员（如果需要）：

```bash
# 如果仓库提供 create-admin.js 或 packages/api/create-admin.ts
node create-admin.js
# or
pnpm --filter @collab/api tsx packages/api/create-admin.ts
```

**注记**
- 已把邮件发送改为在未配置 SMTP 时 no-op，避免测试依赖外部 SMTP。
- 若希望我把多个测试辅助脚本移动到 `packages/api/test-scripts/` 下或创建一个包含 `docker-compose` 启动/销毁、env 注入的一键脚本，我可以继续实现。

**本地运行常见问题**

- 若运行 `./scripts/test.sh` 立刻退出并只看到“正在清理测试环境”，通常表示本地未安装或未启动 Docker。请安装并启动 Docker，然后重试。
- 必须确保 `docker compose` 可用（Docker Compose V2）或使用 `docker-compose` 命令；脚本会检查 `docker` 可用性并在无法访问时给出提示。
- 若 CI 报 `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`，请确认 `DATABASE_URL` 格式正确，密码部分不能为空或非字符串。
- 若 CI/本地报 `NOAUTH Authentication required`，请检查 `REDIS_URL` 是否包含错误的密码占位符（例如 `redis://:undefined@...`），或者 Redis 实例被配置为需要密码。

---
需要我把这些说明文件提交到仓库（创建并 commit `packages/api/TESTS.md`），并把辅助脚本移动到 `packages/api/test-scripts/` 吗？（Y/N）