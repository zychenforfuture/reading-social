# 脚本说明

本目录当前保留一个脚本：`test.sh`。

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

说明：
- 开发启动统一使用 `pnpm run dev:all`，不再使用旧的 `scripts/dev.sh`。
- 生产部署统一使用根目录 `deploy.sh`。

## 相关文档

- [docs/development.md](../docs/development.md) - 开发文档
- [docs/testing.md](../docs/testing.md) - 测试文档
- [docs/deployment.md](../docs/deployment.md) - 部署文档
