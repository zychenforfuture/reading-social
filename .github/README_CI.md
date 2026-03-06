# CI/CD 配置说明

## GitHub Actions 工作流

### 触发条件

- ✅ Push 到 `main` 分支
- ✅ Pull Request  targeting `main` 分支

### 执行流程

```yaml
1.  checkout 代码
    ↓
2.  设置 Node.js 20
    ↓
3.  启用 Corepack (自动使用 package.json 指定的 pnpm 版本)
    ↓
4.  安装依赖 (pnpm install)
    ↓
5.  运行 Lint 检查
    ↓
6.  启动 PostgreSQL + Redis 服务
    ↓
7.  运行单元测试
    ↓
8.  构建所有包
```

### 服务依赖

CI 环境自动提供：

| 服务 | 版本 | 端口 | 用途 |
|------|------|------|------|
| PostgreSQL | 16-alpine | 5432 | 测试数据库 |
| Redis | 7-alpine | 6379 | 缓存/队列 |

### 环境变量

```env
NODE_ENV=test
DATABASE_URL=postgresql://admin:testpassword@localhost:5432/collab_comments_test
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
JWT_SECRET=test-jwt-secret-for-ci-testing-only-min-32-chars
FRONTEND_URL=http://localhost:5173
```

---

## 本地调试 CI

### 使用 act (GitHub Actions Local Runner)

```bash
# 安装 act
brew install act

# 运行完整工作流
act push

# 运行特定 job
act -j test

# 使用不同的 secret
act -s MY_SECRET=value
```

### 手动模拟

```bash
# 1. 启动测试数据库
docker run -d --name postgres-test \
  -e POSTGRES_DB=collab_comments_test \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=testpassword \
  -p 5432:5432 \
  postgres:16-alpine

# 2. 启动 Redis
docker run -d --name redis-test \
  -p 6379:6379 \
  redis:7-alpine

# 3. 运行测试
export DATABASE_URL=postgresql://admin:testpassword@localhost:5432/collab_comments_test
export REDIS_URL=redis://localhost:6379
pnpm --filter @collab/api test

# 4. 清理
docker stop postgres-test redis-test
docker rm postgres-test redis-test
```

---

## 常见问题排查

### ❌ 测试失败

**检查点：**
1. 数据库连接是否正常
2. 环境变量是否配置
3. 测试数据是否清理

**解决方法：**
```bash
# 查看详细日志
pnpm --filter @collab/api test --reporter=verbose

# 只运行特定测试
pnpm --filter @collab/api test -- --grep "Auth Routes"
```

### ❌ pnpm 版本冲突

**错误信息：**
```
ERR_PNPM_BAD_PM_VERSION
```

**解决方法：**
确保 `.github/workflows/ci.yml` 中的 pnpm 版本与 `package.json` 的 `packageManager` 字段一致：

```json
{
  "packageManager": "pnpm@9.15.0"
}
```

### ❌ 数据库连接失败

**检查点：**
```bash
# 测试数据库连接
docker exec -it collab-postgres psql -U admin -d collab_comments_test -c "SELECT 1"
```

---

## 配置优化建议

### 当前配置

- ✅ 使用 Corepack 管理 pnpm 版本
- ✅ 自动启动测试服务
- ✅ 测试后自动清理
- ✅ 构建验证

### 未来可以添加

- [ ] 测试覆盖率报告上传
- [ ] Docker 镜像构建并推送
- [ ] 自动部署到生产环境
- [ ] Slack/Discord 通知
- [ ] 性能测试

---

## 相关文件

- `.github/workflows/ci.yml` - CI 工作流配置
- `packages/api/vitest.config.ts` - Vitest 测试配置
- `packages/api/src/__tests__/` - 测试文件目录
- `TESTING.md` - 测试指南

---

**维护者**: @zychenforfuture  
**最后更新**: 2026-03-06
