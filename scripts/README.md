# 📜 开发脚本说明

本目录包含项目开发和部署相关的辅助脚本。

---

## 🚀 开发环境脚本

### `dev.sh` - 启动开发环境

**功能：**
- 一键启动 Docker 基础设施（PostgreSQL + Redis + Qdrant）
- 启动 API 开发服务器（支持热重载）
- 启动 Web 开发服务器（支持热重载）
- 显示服务访问地址
- 实时输出日志

**使用方法：**
```bash
./scripts/dev.sh
```

**访问地址：**
- Web: http://localhost:5173
- API: http://localhost:3000
- API Docs: http://localhost:3000/api/docs

**日志文件：**
- API: `logs/api.log`
- Web: `logs/web.log`

---

### `dev-stop.sh` - 停止开发环境

**功能：**
- 停止所有 Node.js 开发进程
- 停止 Docker 基础设施
- 清理临时文件

**使用方法：**
```bash
./scripts/dev-stop.sh
```

---

### `test.sh` - 运行测试

**功能：**
- 启动测试用 Docker 基础设施
- 运行 API 和 Web 测试套件
- 生成测试报告

**使用方法：**
```bash
./scripts/test.sh
```

**选项：**
```bash
# 运行所有测试
./scripts/test.sh

# 运行 API 测试
./scripts/test.sh api

# 运行 Web 测试
./scripts/test.sh web

# 生成覆盖率报告
./scripts/test.sh --coverage
```

---

## 📝 使用提示

1. **首次使用**：先运行 `pnpm install` 安装依赖
2. **开发模式**：使用 `./scripts/dev.sh` 启动完整开发环境
3. **测试代码**：使用 `./scripts/test.sh` 运行测试
4. **清理环境**：使用 `./scripts/dev-stop.sh` 停止所有服务

---

## 🔧 故障排查

### Docker 权限问题

如果遇到 Docker 权限错误：
```bash
# 将用户添加到 docker 组
sudo usermod -aG docker $USER

# 重新登录或重启 Docker 服务
newgrp docker
```

### 端口被占用

如果端口被占用，可以：
```bash
# 查找占用端口的进程
lsof -i :3000  # API
lsof -i :5173  # Web
lsof -i :5433  # PostgreSQL
lsof -i :6380  # Redis

# 停止占用进程
kill -9 <PID>
```

### 查看详细日志

```bash
# 查看 API 日志
tail -f logs/api.log

# 查看 Web 日志
tail -f logs/web.log

# 查看 Docker 日志
docker compose -f docker-compose.test.yml logs
```

---

## 📚 相关文档

- [DEVELOPMENT.md](../DEVELOPMENT.md) - 完整开发指南
- [README.md](../README.md) - 项目概述
- [LOCAL_TESTING.md](../LOCAL_TESTING.md) - 本地测试指南
