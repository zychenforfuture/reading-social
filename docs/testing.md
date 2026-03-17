# 测试文档

本文件是测试执行与排障的最小说明。

## 1. 一键执行（推荐）

```bash
pnpm test
```

等价于：

```bash
./scripts/test.sh
```

脚本会自动处理测试容器生命周期并执行 API 测试。

## 2. 手动测试流程

### 启动测试基础设施

```bash
docker compose -f docker-compose.test.yml up -d
```

### 设置环境变量

```bash
export NODE_ENV=test
export DATABASE_URL=postgresql://admin:testpassword@localhost:5433/collab_comments_test
export REDIS_URL=redis://localhost:6380
export QDRANT_URL=http://localhost:6334
export JWT_SECRET=test-jwt-secret-for-local-testing-min-32-chars
export FRONTEND_URL=http://localhost:5173
```

### 执行测试

```bash
pnpm --filter @collab/api test
pnpm --filter @collab/api test:watch
pnpm --filter @collab/api test --coverage
```

### 清理环境

```bash
docker compose -f docker-compose.test.yml down
```

## 3. 当前测试文件

### API 测试文件（10 个）

- auth.test.ts
- auth-integration.test.ts
- document.test.ts
- comment.test.ts
- block.test.ts
- concurrency.test.ts
- boundary.test.ts
- middleware.test.ts
- types.test.ts
- performance.test.ts（性能基准测试）

### Web 测试文件（3 个）

运行命令：`pnpm --filter @collab/web test run`

- src/components/Button.test.tsx（5 个测试）
- src/lib/utils.test.ts（16 个测试）：cn()、timeAgo()
- src/utils/chapterUtils.test.ts（13 个测试）：buildChapters()

### Worker 测试文件（3 个）

运行命令：`pnpm --filter @collab/worker test`

- src/__tests__/simhash.test.ts（15 个测试）
- src/__tests__/embedding.test.ts（2 个测试）
- src/__tests__/worker.integration.test.ts（2 个测试）

## 4. 常见问题

### 端口占用

```bash
lsof -i :5433
lsof -i :6380
lsof -i :6334
```

### 测试数据库连接失败

```bash
docker compose -f docker-compose.test.yml ps
docker compose -f docker-compose.test.yml logs postgres-test
```

### 测试超时

```bash
pnpm --filter @collab/api test -- --test-timeout=60000
```

## 5. 覆盖率报告

```bash
pnpm --filter @collab/api test --coverage
open packages/api/coverage/index.html
```

更新时间：2026-03-17
