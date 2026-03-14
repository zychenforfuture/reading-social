# 脚本说明

本目录当前保留两个脚本：`test.sh` 和 `deploy.sh`。

## test.sh

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

## deploy.sh

用途：生产部署入口。

常用命令：

```bash
# 启动服务
./scripts/deploy.sh up

# 查看状态和日志
./scripts/deploy.sh status
./scripts/deploy.sh logs

# 重启或重建
./scripts/deploy.sh restart
./scripts/deploy.sh rebuild

# 停止与备份
./scripts/deploy.sh down
./scripts/deploy.sh db-backup
```

说明：
- 开发模式采用混合模式：Docker 跑基础设施，本地运行 API/Worker/Web（`pnpm run dev:all`）。
- 部署模式采用全 Docker 模式：统一使用 `scripts/deploy.sh`。

## 相关文档

- [docs/development.md](../docs/development.md) - 开发文档
- [docs/testing.md](../docs/testing.md) - 测试文档
- [docs/deployment.md](../docs/deployment.md) - 部署文档
