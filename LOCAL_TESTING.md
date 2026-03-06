# 本地测试指南

本文档说明如何在本地运行完整测试（包括数据库集成测试）。

---

## 🚀 快速开始

### 一键运行所有测试

```bash
# 在项目根目录执行
./scripts/test.sh
```

**脚本会自动：**
1. ✅ 启动测试服务（PostgreSQL + Redis + Qdrant）
2. ✅ 配置测试环境变量
3. ✅ 运行所有测试
4. ✅ 清理测试服务

---

## 📦 手动运行测试

### 步骤 1: 启动测试服务

```bash
# 使用测试专用的 Docker Compose 配置
docker compose -f docker-compose.test.yml up -d
```

**启动的服务：**
| 服务 | 端口 | 用途 |
|------|------|------|
| PostgreSQL | 5433 | 测试数据库 |
| Redis | 6380 | 测试缓存 |
| Qdrant | 6334 | 测试向量库 |

### 步骤 2: 配置环境变量

```bash
export NODE_ENV=test
export DATABASE_URL=postgresql://admin:testpassword@localhost:5433/collab_comments_test
export REDIS_URL=redis://localhost:6380
export QDRANT_URL=http://localhost:6334
export JWT_SECRET=test-jwt-secret-for-local-testing-min-32-chars
export FRONTEND_URL=http://localhost:5173
```

### 步骤 3: 运行测试

```bash
# 运行所有测试
pnpm --filter @collab/api test

# 运行特定测试文件
pnpm --filter @collab/api test -- middleware.test.ts

# 监听模式（开发时使用）
pnpm --filter @collab/api test:watch

# 生成覆盖率报告
pnpm --filter @collab/api test --coverage
```

### 步骤 4: 清理服务

```bash
docker compose -f docker-compose.test.yml down
```

---

## 🧪 测试文件说明

### 已实现的测试

| 文件 | 测试内容 | 依赖服务 | 运行方式 |
|------|----------|----------|----------|
| `middleware.test.ts` | JWT Token 生成、中间件函数 | 无 | 本地直接运行 |
| `auth.test.ts` | 登录、注册、权限验证 | PostgreSQL + Redis | 需要 Docker |

### 运行示例

**仅运行无依赖测试（快速）：**
```bash
pnpm --filter @collab/api test -- middleware.test.ts
# 耗时：~3ms
```

**运行完整测试（含数据库）：**
```bash
./scripts/test.sh
# 耗时：~10-30 秒（含服务启动）
```

---

## 🔧 故障排查

### 问题 1: 服务启动失败

**错误信息：**
```
port is already allocated
```

**解决方法：**
```bash
# 检查端口占用
lsof -i :5433
lsof -i :6380

# 停止占用端口的进程
kill -9 <PID>

# 或者修改 docker-compose.test.yml 使用其他端口
```

### 问题 2: 数据库连接失败

**错误信息：**
```
ECONNREFUSED connect ECONNREFUSED 127.0.0.1:5433
```

**解决方法：**
```bash
# 检查服务是否运行
docker compose -f docker-compose.test.yml ps

# 查看服务日志
docker compose -f docker-compose.test.yml logs postgres-test

# 等待服务完全启动（健康检查通过）
docker compose -f docker-compose.test.yml up -d
sleep 10
```

### 问题 3: 测试超时

**解决方法：**
```bash
# 增加测试超时时间
pnpm --filter @collab/api test -- --test-timeout=60000
```

---

## 📊 测试覆盖率

### 查看覆盖率报告

```bash
# 生成 HTML 报告
pnpm --filter @collab/api test --coverage

# 在浏览器中打开
open packages/api/coverage/index.html
```

### 覆盖率目标

| 指标 | 当前 | 目标 |
|------|------|------|
| 分支覆盖率 | - | ≥ 50% |
| 函数覆盖率 | - | ≥ 50% |
| 行覆盖率 | - | ≥ 50% |

---

## 🎯 最佳实践

### 1. 开发时使用监听模式

```bash
# 自动重新运行测试
pnpm --filter @collab/api test:watch
```

### 2. 提交前运行完整测试

```bash
# 确保所有测试通过
./scripts/test.sh
```

### 3. 只运行相关测试

```bash
# 运行特定测试文件
pnpm --filter @collab/api test -- auth.test.ts

# 运行匹配的测试用例
pnpm --filter @collab/api test -- -t "登录"
```

### 4. 使用 VS Code 测试插件

安装 [Vitest](https://marketplace.visualstudio.com/items?itemName=vitest.explorer) 插件，直接在编辑器中运行测试。

---

## 🗑️ 清理测试数据

### 清理 Docker 容器

```bash
# 停止并删除所有测试容器
docker compose -f docker-compose.test.yml down -v
```

### 清理测试数据库

```bash
# 进入测试数据库
docker exec -it collab-postgres-test psql -U admin -d collab_comments_test

# 删除所有测试用户
DELETE FROM users WHERE email LIKE 'test_%@example.com';
```

---

## 📚 相关文件

- `docker-compose.test.yml` - 测试服务配置
- `scripts/test.sh` - 自动化测试脚本
- `packages/api/vitest.config.ts` - Vitest 配置
- `packages/api/src/__tests__/` - 测试文件目录

---

## 💡 与 GitHub Actions 对比

| 特性 | 本地测试 | GitHub Actions |
|------|----------|----------------|
| **速度** | ⚡ 快（无网络延迟） | 🐌 慢（需启动 VM） |
| **调试** | ✅ 方便（可直接查看） | ❌ 困难（需看日志） |
| **成本** | 💰 免费 | 💰 免费（有额度限制） |
| **一致性** | ⚠️ 依赖本地环境 | ✅ 完全一致 |
| **自动化** | ❌ 需手动运行 | ✅ 自动触发 |

**建议：**
- 开发时：使用本地测试（快速迭代）
- 提交前：运行本地完整测试
- 提交后：依赖 GitHub Actions 验证

---

**开始测试吧！** 🚀

```bash
./scripts/test.sh
```
