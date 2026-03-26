# Reading-Social Docker 部署指南

本项目基于 `docker-compose` 编排，只需简单的环境配置即可在本地或服务器上一键启动所有依赖（Postgres、Redis、Qdrant）及核心微服务（API、Web、Worker）。

## 🚀 快速启动

> [!NOTE]
> 确保你的宿主机已安装了 Docker 和 Docker Compose。推荐分配至少 4GB 内存给 Docker，因为 Qdrant 和 API 服务需要一定的资源。

### 1. 配置环境变量

项目根目录需要一份 `.env` 文件。你可以在根目录（同 `docker-compose.yml` 层级）创建一个 `.env` 文件，内容参考如下：

```env
# 核心秘钥和密码
JWT_SECRET=your_super_secret_jwt_key_here
DB_PASSWORD=CollabDev2026!
REDIS_PASSWORD=CollabDev2026!

# 服务地址配置
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

*(如果未提供 `.env`，`docker-compose.yml` 中已设置了适用于本地开发的 fallback 默认值。)*

### 2. 构建并启动集群

首次启动或修改了依赖（`package.json`）及业务代码后，推荐运行带有 `--build` 参数的后台启动命令：

```bash
docker-compose up -d --build
```

此命令将会：
1. 启动并初始化所有底层中间件组件：PostgreSQL (`collab-postgres`)、Redis (`collab-redis`)、Qdrant (`collab-qdrant`)。
2. 构建并启动核心微服务：API 服务 (`collab-api`)、任务调度 Worker (`collab-worker`) 以及前端网页 (`collab-web`)。

> [!TIP]
> **API 容器的自启动迁移机制**  
> 在我们新的重构设计下，`collab-api` 在启动前会自动执行 `pnpm run db:migrate`。它会扫描最新的 `migrations/sqls` 下的 `.sql` 脚本，将所有尚未应用的表结构主动落库（如 Users, Documents 等表）。你不需要手动去连接数据库运行 SQL 脚本！

### 3. 查看运行状态

你可以通过以下命令检查各个服务的运行健康状态：

```bash
docker-compose ps
```

为了确认数据库结构是否成功迁移完毕或排查报错，你可以查看 API 服务的日志：

```bash
# 实时跟踪 API 运行日志
docker-compose logs -f api

# 实时跟踪后台 Embedding Worker 队列日志
docker-compose logs -f worker
```

---

## 🏗️ 架构概览

目前的 `docker-compose` 包含以下容器组：

| 容器名称 | 内部映射 | 对外端口 | 用途说明 |
| :--- | :--- | :--- | :--- |
| `collab-web` | Nginx (80) | `80` (HTTP) | 前端静态资源代理和加载入口 |
| `collab-api` | Node (3000) | `3000` | 核心业务 API（用户验证、SSE 通信、文档读取等） |
| `collab-worker` | Node | （不用对外暴露） | BullMQ 消费端（CPU 密集型的 SimHash、Embedding 异步生成） |
| `collab-postgres` | Postgres (5432) | `5432` | 保存基础配置、用户数据、文档以及关系表数据 |
| `collab-redis`| Redis (6379) | `6379` | 为 BullMQ 队列和 SSE PUB/SUB 通信提供中间件缓存 |
| `collab-qdrant` | Qdrant (6333) | `6333`, `6334` | 存储经模型转换的高维向量及其它 AI 搜索索引 |

---

## 🛠️ 数据持久化与清理

所有带状态的服务（Postgres, Redis, Qdrant）都已被配置挂载在项目内的 `/volumes` 本地目录中执行：

- 数据库文件：`./volumes/postgres/data`
- 缓存文件：`./volumes/redis`
- 向量存储：`./volumes/qdrant`

> [!WARNING]
> 如果你需要彻底**重置并清空**所有测试数据（包含向量数据库），执行时可以结合 `-v` 参数：
> ```bash
> # 停止并销毁内部镜像环境及挂载的持久化存储卷
> docker-compose down -v
> 
> # 或者你也可以手动删除本地文件夹
> sudo rm -rf ./volumes
> ```

## 📋 容器间的包管理限制处理

项目中在不同微服务间采取了不同的 Dockerfile 拆分构建和缓存层。如果你发现因锁文件 (`pnpm-lock.yaml`) 与新增加的 Node 依赖不同步导致的 `pnpm install` 失败：

不要担心，目前最新的 `Dockerfile` 已经去掉了 `frozen-lockfile` 本地硬校验模式。利用 `--build` 构建镜像时，Docker 内部自带的环境（Node 20）将会智能拉取、更新依赖并抹平宿主机因版本太低而无从构建的痛点。

祝部署顺利！🚀
