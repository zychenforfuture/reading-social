# 测试指南

本文档描述当前测试范围、执行方式和扩展建议。

## 测试框架

- API：Vitest + Supertest
- Web：暂无自动化测试
- Worker：暂无自动化测试

## 运行方式

### 推荐（仓库根）

```bash
pnpm test
```

该命令会调用 scripts/test.sh，自动处理测试容器生命周期。

### API 包内命令

```bash
pnpm --filter @collab/api test
pnpm --filter @collab/api test:watch
pnpm --filter @collab/api test --coverage
```

## 当前测试清单

API 当前包含以下 9 个测试文件：

- auth.test.ts
- auth-integration.test.ts
- document.test.ts
- comment.test.ts
- block.test.ts
- concurrency.test.ts
- boundary.test.ts
- middleware.test.ts
- types.test.ts

覆盖重点：
- 认证与权限（JWT、管理员）
- 文档上传/列表/删除
- 评论创建/回复/点赞/删除
- 内容块查询
- 并发与边界条件

## 覆盖率报告

```bash
pnpm --filter @collab/api test --coverage
open packages/api/coverage/index.html
```

## 新增测试建议

1. 为 Worker 增加相似检测与向量写入的单元测试。
2. 为 Web 增加关键页面路由与交互测试。
3. 增加通知 API 端到端测试。

## 故障排查

### 数据库连接失败

```bash
docker compose -f docker-compose.test.yml ps
docker compose -f docker-compose.test.yml logs postgres-test
```

### 端口冲突

```bash
lsof -i :5433
lsof -i :6380
lsof -i :6334
```

### 测试超时

```bash
pnpm --filter @collab/api test -- --test-timeout=60000
```

更新时间：2026-03-14
