# 测试指南

本文档说明如何运行测试、编写新测试以及理解项目的测试策略。

---

## 🧪 测试框架

- **API**: Vitest + Supertest
- **Web**: (待添加)
- **Worker**: (待添加)

---

## 📦 运行测试

### API 测试

```bash
# 运行所有测试
pnpm --filter @collab/api test

# 监听模式（开发时使用）
pnpm --filter @collab/api test:watch

# 生成覆盖率报告
pnpm --filter @collab/api test --coverage
```

### 覆盖率要求

当前配置要求：
- 分支覆盖率：≥ 50%
- 函数覆盖率：≥ 50%
- 行覆盖率：≥ 50%

覆盖率报告生成在 `packages/api/coverage/` 目录。

---

## 📝 编写测试

### 测试文件位置

测试文件应放在 `src/__tests__/` 目录下，命名格式为 `*.test.ts`。

```
packages/api/src/
├── __tests__/
│   ├── auth.test.ts      # 认证模块测试
│   ├── document.test.ts  # 文档模块测试（待添加）
│   └── comment.test.ts   # 评论模块测试（待添加）
├── routes/
├── middleware/
└── ...
```

### 测试示例

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('API Routes', () => {
  beforeAll(async () => {
    // 测试前初始化
  });

  afterAll(async () => {
    // 测试后清理
  });

  it('应该返回 200 OK', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

### 测试最佳实践

1. **测试隔离** - 每个测试应独立运行，不依赖其他测试的状态
2. **清理数据** - 使用 `afterAll` 清理测试数据
3. **有意义的断言** - 不仅检查状态码，还要检查响应内容
4. **错误场景** - 测试正常路径的同时，也要测试错误处理
5. **异步处理** - 使用 `async/await`，避免回调地狱

---

## 🎯 测试覆盖范围

### 已覆盖模块

| 模块 | 测试文件 | 覆盖率 | 状态 |
|------|----------|--------|------|
| Auth | `auth.test.ts` | - | ✅ 基础测试 |
| Documents | (待添加) | - | ⏳ 待编写 |
| Comments | (待添加) | - | ⏳ 待编写 |
| Blocks | (待添加) | - | ⏳ 待编写 |
| Middleware | (待添加) | - | ⏳ 待编写 |

### 待添加测试

1. **文档模块测试**
   - 上传文档
   - 获取文档列表
   - 删除文档权限验证

2. **评论模块测试**
   - 创建评论
   - 创建回复
   - 点赞/取消点赞
   - 删除评论权限验证

3. **中间件测试**
   - JWT 鉴权中间件
   - 管理员权限验证

---

## 🔄 CI/CD 集成

### GitHub Actions

项目配置了自动 CI 流程：

- **触发条件**: push 到 main/dev 分支，或 PR
- **运行内容**:
  - 安装依赖
  - 运行 lint
  - 运行测试
  - 构建所有包
  - 构建 Docker 镜像（仅 main 分支）

### 本地验证

在提交前，建议本地运行：

```bash
# 完整检查流程
pnpm install
pnpm -r lint
pnpm --filter @collab/api test
pnpm -r build
```

---

## 🐛 测试数据库

测试使用独立的数据库配置：

```env
NODE_ENV=test
DATABASE_URL=postgresql://admin:testpassword@localhost:5432/collab_comments_test
```

测试数据会在测试结束后自动清理（通过 `afterAll` 钩子）。

---

## 📊 覆盖率报告

运行测试后生成 HTML 报告：

```bash
pnpm --filter @collab/api test --coverage
open packages/api/coverage/index.html
```

---

## 🔧 故障排查

### 测试失败

1. **数据库连接失败** - 确保测试数据库已创建且可访问
2. **端口冲突** - 检查 5432 (Postgres)、6379 (Redis) 是否被占用
3. **环境变量缺失** - 检查 `.env.test` 或环境变量是否配置

### 覆盖率不达标

1. 运行 `pnpm --filter @collab/api test --coverage` 查看详细报告
2. 针对未覆盖的函数/分支添加测试用例
3. 对于无法测试的代码（如日志），使用 `/* istanbul ignore next */` 忽略

---

## 📚 参考资料

- [Vitest 文档](https://vitest.dev/)
- [Supertest 文档](https://github.com/ladjs/supertest)
- [Testing Library](https://testing-library.com/)

---

**目标**: 逐步提升测试覆盖率，确保核心功能稳定可靠！
