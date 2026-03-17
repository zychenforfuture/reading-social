# 开发文档

本文件是本地开发的最小闭环说明。

开发模式：混合模式（Docker 基础设施 + 本地 Node 进程）。

## 1. 环境要求

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose
- 根目录 .env 已配置：DATABASE_URL、REDIS_URL、QDRANT_URL、JWT_SECRET、FRONTEND_URL

### 1.1 .env 配置

首次开发前需要创建 `.env` 文件：

```bash
# 复制模板文件
cp .env.example .env

# 编辑 .env 文件，填写实际配置
# 最少需要配置以下项：
# - DB_PASSWORD: 数据库密码（建议使用强密码）
# - DATABASE_URL: PostgreSQL 连接字符串
# - REDIS_PASSWORD: Redis 密码
# - REDIS_URL: Redis 连接字符串  
# - JWT_SECRET: JWT 签名密钥（必须至少 32 字符，建议使用 openssl rand -hex 32 生成）
# - FRONTEND_URL: 前端访问地址
```

**注意事项：**
- JWT_SECRET 必须至少 32 字符，启动时会进行复杂度验证（长度、熵值、弱模式检查）
- 不要使用默认的示例密码，生成安全的随机密钥
- 生产环境部署前务必更换所有默认值

## 2. 推荐启动

```bash
pnpm install
pnpm run dev:all
```

说明：`dev:all` 采用混合模式，会启动 postgres、redis、qdrant（容器），并在本机拉起 API、Worker、Web。

### 2.1 首次启动说明

首次运行 `pnpm run dev:all` 时，系统会自动完成以下初始化：

1. **Docker 容器启动**：启动 PostgreSQL、Redis、Qdrant 容器
2. **数据库初始化**：自动创建必要的数据库表和索引
3. **Qdrant 初始化**：创建向量数据库集合（首次启动可能需要等待 30-60 秒）
4. **环境变量验证**：验证 JWT_SECRET 等关键配置的安全性和复杂度

**首次启动特别注意事项：**

- **Qdrant 初始化**：首次启动时 Qdrant 需要创建向量集合，可能需要较长时间（30-60 秒），如果看到相关初始化日志属正常现象
- **JWT_SECRET 验证**：启动时会强制验证 JWT_SECRET 的复杂度，如果验证失败服务将无法启动
- **管理员账号**：如果在 `.env` 中配置了 `ADMIN_INIT_EMAIL`，系统会自动创建初始管理员账号

**启动完成标志：**
看到类似以下日志表示启动成功：
```
✅ 环境变量验证通过（JWT_SECRET 熵值：4.xx）
PostgreSQL connected
Redis connected
Qdrant initialized
API server running on port 3000
```

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

### JWT_SECRET 相关问题

#### JWT_SECRET 太弱或不合法

如果遇到 JWT_SECRET 验证失败的错误：

```bash
# 生成安全的 JWT_SECRET
openssl rand -hex 32

# 或者使用 base64
openssl rand -base64 32
```

**验证机制说明：**
- **长度验证**：JWT_SECRET 长度必须至少 32 字符
- **熵值验证**：熵值必须至少 3.5 比特/字符（确保随机性）
- **弱模式检测**：不能包含 "password"、"123456" 等常见弱模式
- **默认值防护**：不能使用默认值 "dev-secret-change-in-prod"

如果验证失败，应用会显示具体的错误信息并退出，需要修正后重新启动。

### Qdrant 异常

```bash
docker compose logs -f qdrant
```

### SSE 异常

先确认 API 健康，再检查反向代理和连接数限制。

## 6. 开发建议

- 联调优先用 `pnpm run dev:all`。
- 精细排障优先用手动启动分服务查看日志。
- 首次启动时注意 Qdrant 初始化需要 30-60 秒。
- 确保 JWT_SECRET 符合复杂度要求，否则无法启动。

更新时间：2026-03-14
