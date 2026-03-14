# 共鸣阅读（内部开发版）

本文档面向项目维护者与协作者，记录当前实现边界、模块职责、开发命令与排障路径。

## 1. 项目定位与边界

- 这是一个跨文档协同批注平台原型。
- 当前主线能力：Web + API + Worker 已形成闭环，Mobile 为基础可用。
- 关键边界：
  - 跨文档评论在后端具备重映射能力，但前端聚合视图未产品化。
  - Embedding 计算与存储已实现，面向终端用户的“向量检索产品体验”仍在迭代。
  - 文档通路以文本为主，PDF/EPUB 完整解析链路未完成。

## 2. 模块结构

```text
reading/
├── packages/
│   ├── api/        # Express API（鉴权、文档、评论、通知、Swagger）
│   ├── web/        # React Web（阅读、评论、设置、通知中心）
│   ├── worker/     # BullMQ Worker（分块、相似检测、向量写入）
│   └── mobile/     # Expo 移动端（登录、阅读、评论、个人资料）
├── docker/         # nginx/postgres 配置
├── scripts/        # 测试与辅助脚本
├── docker-compose.yml
├── docker-compose.test.yml
└── docker-compose.prod.yml
```

## 3. 能力矩阵（按代码实现）

| 模块 | 状态 | 说明 |
|------|------|------|
| Web | ✅ 已完成 | 登录、注册、找回、阅读、评论、阅读设置、通知中心 |
| API | ✅ 已完成 | JWT、OTP、评论 SSE、通知 API、Swagger |
| Worker | ✅ 已完成 | SimHash + Embedding、Qdrant 写入、混合去重 |
| Mobile | ⚠️ 部分完成 | 主流程可用，通知中心与阅读设置未补齐 |
| 测试 | ✅ 部分覆盖 | API 9 个测试文件 |

## 4. 核心技术实现要点

### 4.1 评论与实时同步

- 评论/回复/点赞在 API 完整实现。
- SSE 用于评论实时推送。

### 4.2 相似检测与向量通路

- SimHash：64 位指纹，海明距离阈值 <= 3。
- Embedding：all-MiniLM-L6-v2，384 维向量。
- 混合策略：Embedding 仅补充 SimHash 未覆盖的相似关系。
- Embedding 异步计算，不阻塞文档 ready。

### 4.3 跨文档能力

- 后端支持 sentence_hash 与评论重映射。
- 当前前端暂无“跨文档来源可视化聚合视图”。

## 5. 开发命令

### 5.1 本地开发

```bash
pnpm install
pnpm run dev:all
```

手动模式：

```bash
docker compose up -d postgres redis qdrant
pnpm --filter @collab/api dev
pnpm --filter @collab/worker dev
pnpm --filter @collab/web dev
```

### 5.2 测试

```bash
pnpm test
pnpm test:quick
pnpm test:watch
```

API 现有测试文件：

- auth.test.ts
- auth-integration.test.ts
- document.test.ts
- comment.test.ts
- block.test.ts
- concurrency.test.ts
- boundary.test.ts
- middleware.test.ts
- types.test.ts

### 5.3 部署

```bash
cp .env.production.example .env.production
./deploy.sh up
./deploy.sh status
./deploy.sh logs
```

或：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 6. 常见排障入口

- 本地开发与环境排查：见 [LOCAL_DEV.md](../LOCAL_DEV.md)
- 本地测试全流程：见 [LOCAL_TESTING.md](../LOCAL_TESTING.md)
- 测试策略与扩展：见 [TESTING.md](../TESTING.md)
- 通知系统实现：见 [NOTIFICATION_SYSTEM.md](../NOTIFICATION_SYSTEM.md)

## 7. 协作约定（文档层）

- 根 README 保持对外展示风格（简短、可快速上手）。
- 详细技术说明优先写入本文件和专题文档。
- 状态标记统一使用：✅ 已完成 / ⚠️ 部分完成 / ⏳ 规划中。
- 更新文档时，优先确保“代码事实 -> 文档结论”单向映射，避免超前承诺。

更新时间：2026-03-14
