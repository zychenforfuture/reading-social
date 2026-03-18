# 脚本说明

本目录包含本地开发、测试与部署的自动化脚本。

## dev.sh（混合开发）

用途：一键启动/关闭混合模式（Docker 基础设施 + 本地 API/Worker/Web）。

常用命令：

```bash
./scripts/dev.sh up        # 启动基础设施 + 本地进程，按 Ctrl+C 结束本地进程
./scripts/dev.sh infra     # 仅启动基础设施容器
./scripts/dev.sh down      # 停止基础设施容器
./scripts/dev.sh logs      # 查看基础设施日志
./scripts/dev.sh status    # 查看基础设施状态
```

可选：通过 `ENV_FILE` 覆盖环境文件（默认 `.env`）。

## test.sh（本地测试）

用途：本地一键测试入口。

执行流程：
- 启动测试用基础设施（PostgreSQL + Redis + Qdrant）
- 初始化测试数据库
- 注入测试环境变量
- 运行 API 测试
- 自动清理测试容器

使用方式：

```bash
# 推荐（根目录）
pnpm test

# 等价执行
./scripts/test.sh

# 运行指定测试文件
./scripts/test.sh auth.test.ts
```

## deploy.sh（全 Docker 部署）

用途：生产部署入口，依赖 `.env.production`（可用 ENV_FILE 指定）。

常用命令：

```bash
./scripts/deploy.sh up       # 构建并启动
./scripts/deploy.sh status   # 查看状态
./scripts/deploy.sh logs     # 跟随日志
./scripts/deploy.sh restart  # 重启
./scripts/deploy.sh rebuild  # 强制重建镜像
./scripts/deploy.sh down     # 停止容器
./scripts/deploy.sh db-backup # 生成数据库备份
```

说明：
- 开发模式：Docker 跑基础设施，本地运行 API/Worker/Web（可用 `scripts/dev.sh up`）。
- 部署模式：全 Docker 模式，使用 `scripts/deploy.sh`。

## 相关文档

- [docs/development.md](../docs/development.md) - 开发文档
- [docs/testing.md](../docs/testing.md) - 测试文档
- [docs/deployment.md](../docs/deployment.md) - 部署文档
