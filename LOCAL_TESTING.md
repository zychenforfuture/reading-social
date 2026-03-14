# 本地测试指南

本文档用于本地运行 API 测试并排查常见问题。

## 快速执行

```bash
# 在仓库根目录
./scripts/test.sh
```

脚本会自动：
1. 启动测试容器（PostgreSQL + Redis + Qdrant）
2. 设置测试环境变量
3. 执行 API 测试
4. 清理测试容器

## 手动执行

### 1) 启动测试基础设施

```bash
docker compose -f docker-compose.test.yml up -d
```

### 2) 配置环境变量

```bash
export NODE_ENV=test
export DATABASE_URL=postgresql://admin:testpassword@localhost:5433/collab_comments_test
export REDIS_URL=redis://localhost:6380
export QDRANT_URL=http://localhost:6334
export JWT_SECRET=test-jwt-secret-for-local-testing-min-32-chars
export FRONTEND_URL=http://localhost:5173
```

### 3) 运行测试

```bash
pnpm --filter @collab/api test
pnpm --filter @collab/api test:watch
pnpm --filter @collab/api test --coverage
```

### 4) 停止测试基础设施

```bash
docker compose -f docker-compose.test.yml down
```

## 当前测试文件（9 个）

- auth.test.ts
- auth-integration.test.ts
- document.test.ts
- comment.test.ts
- block.test.ts
- concurrency.test.ts
- boundary.test.ts
- middleware.test.ts
- types.test.ts

## 常见问题

### 端口占用

```bash
lsof -i :5433
lsof -i :6380
lsof -i :6334
```

### 数据库连接失败

```bash
docker compose -f docker-compose.test.yml ps
docker compose -f docker-compose.test.yml logs postgres-test
```

### 测试超时

```bash
pnpm --filter @collab/api test -- --test-timeout=60000
```

## 覆盖率报告

```bash
pnpm --filter @collab/api test --coverage
open packages/api/coverage/index.html
```

## 相关文件

- docker-compose.test.yml
- scripts/test.sh
- packages/api/vitest.config.ts
- packages/api/src/__tests__/

更新时间：2026-03-14
