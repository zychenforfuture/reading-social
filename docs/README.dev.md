# 共鸣阅读内部开发总览

本文件汇总项目的核心信息，作为开发、测试、部署的统一入口。

## 1. 项目概述

共鸣阅读是一个跨文档协同批注平台原型，核心理念是评论绑定内容而非文档 URL。

当前总体状态：
- Web：可用
- API：可用
- Worker：可用
- Mobile：基础可用

运行模式：
- 开发：混合模式（Docker 基础设施 + 本地服务进程）
- 部署：全 Docker 模式（基础设施与应用服务容器化）

## 2. 能力边界（按当前代码）

| 模块 | 状态 | 说明 |
|------|------|------|
| Web | ✅ 已完成 | 登录注册、阅读、评论回复点赞、目录、阅读设置、通知中心 |
| API | ✅ 已完成 | JWT、OTP、评论、通知、Swagger |
| Worker | ⚠️ 部分完成 | 分块、SimHash 已完成；Embedding 后端链路已完成，Qdrant 未集成 |
| Mobile | ⚠️ 部分完成 | 主流程可用，通知中心与阅读设置待补齐 |
| 跨文档评论产品化 | ⚠️ 部分完成 | 后端有重映射能力，前端聚合视图未完成 |

## 3. 架构与目录

```text
reading/
├── packages/
│   ├── api/
│   ├── web/
│   ├── worker/
│   └── mobile/
├── docker/
├── scripts/
├── docs/
├── docker-compose.yml
├── docker-compose.test.yml
└── docker-compose.prod.yml
```

模块职责：
- packages/api：鉴权、文档、评论、通知、Swagger
- packages/web：阅读、评论、设置、通知 UI
- packages/worker：异步分块、相似检测、向量入库
- packages/mobile：移动端阅读与评论基础流程

## 4. 关键实现要点

### 4.1 评论与实时同步

- 评论、回复、点赞在 API 已完整实现。
- 评论实时更新依赖 SSE。

### 4.2 相似检测与向量能力

- SimHash：64 位指纹，海明距离阈值 <= 3。
- Embedding：all-MiniLM-L6-v2，384 维向量。
- 混合策略：Embedding 仅补充 SimHash 未覆盖结果。
- Embedding 为异步计算，不阻塞文档 ready。

### 4.3 跨文档评论

- 后端支持 sentence_hash 与重映射。
- 当前前端无跨文档来源聚合展示。

## 5. 开发、测试、部署入口

- 开发文档：[development.md](./development.md)
- 测试文档：[testing.md](./testing.md)
- 部署文档：[deployment.md](./deployment.md)

## 6. 常用命令速查

### 开发

```bash
pnpm install
pnpm run dev:all
```

### 测试

```bash
pnpm test
pnpm test:quick
pnpm test:watch
```

### 部署

```bash
cp .env.production.example .env.production
./scripts/deploy.sh up
./scripts/deploy.sh status
./scripts/deploy.sh logs
```

## 7. 已知限制

- 文档上传通路当前以文本为主，PDF/EPUB 完整解析链路待完善。
- 生产 HTTPS 自动化方案待补齐。
- Mobile 通知中心和阅读设置尚未完成。
- 跨文档评论前端聚合视图待实现。

## 8. 维护约定

- 对外信息优先维护在根 README。
- 开发细节统一维护在 docs 目录。
- 状态标记统一：✅ 已完成 / ⚠️ 部分完成 / ⏳ 规划中。

更新时间：2026-03-14
