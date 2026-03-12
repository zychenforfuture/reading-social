# 🚀 开发环境指南

本文档提供完整的本地开发环境配置说明，支持热重载和调试。

---

## 📋 目录

- [系统要求](#-系统要求)
- [快速开始](#-快速开始)
- [目录结构](#-目录结构)
- [开发工作流](#-开发工作流)
- [调试技巧](#-调试技巧)
- [常见问题排查](#-常见问题排查)
- [测试运行方法](#-测试运行方法)

---

## 🖥️ 系统要求

### 必需软件

| 软件 | 最低版本 | 推荐版本 | 安装方式 |
|------|----------|----------|----------|
| Node.js | 18.x | 20.x / 22.x | [nvm](https://github.com/nvm-sh/nvm) |
| pnpm | 8.x | 9.x | `npm install -g pnpm` |
| Docker | 20.x | 24.x+ | [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| Git | 2.x | 最新 | 系统包管理器 |

### 检查安装

```bash
# 检查 Node.js 版本
node -v  # 应 >= 18.0.0

# 检查 pnpm 版本
pnpm -v  # 应 >= 8.0.0

# 检查 Docker
docker -v
docker compose version

# 检查 Git
git --version
```

### 推荐 VSCode 扩展

- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **TypeScript** - TypeScript 支持
- **React** - React 开发支持
- **Docker** - Docker 容器管理
- **Thunder Client** 或 **Postman** - API 测试

---

## ⚡ 快速开始

### 3 步启动开发环境

```bash
# 1️⃣ 克隆并进入项目
cd /home/verson/reading-social

# 2️⃣ 安装依赖
pnpm install

# 3️⃣ 启动开发环境
./scripts/dev.sh
```

### 访问服务

启动成功后，访问以下地址：

| 服务 | 地址 | 说明 |
|------|------|------|
| 📱 Web 前端 | http://localhost:5173 | React 开发服务器 |
| 🔌 API 后端 | http://localhost:3000 | Express API 服务 |
| 📊 API 文档 | http://localhost:3000/api/docs | Swagger UI |
| 🐘 PostgreSQL | localhost:5433 | 数据库 (管理工具连接) |
| 🔴 Redis | localhost:6380 | 缓存服务 |
| 🟠 Qdrant | localhost:6334 | 向量数据库 |

### 停止开发环境

```bash
./scripts/dev-stop.sh
```

---

## 📁 目录结构

```
reading-social/
├── packages/
│   ├── api/              # 后端 API 服务 (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── controllers/   # 请求处理器
│   │   │   ├── middleware/    # 中间件
│   │   │   ├── models/        # 数据模型
│   │   │   ├── routes/        # 路由定义
│   │   │   ├── services/      # 业务逻辑
│   │   │   ├── db/            # 数据库配置和迁移
│   │   │   └── index.ts       # 入口文件
│   │   ├── tests/             # 单元测试
│   │   └── package.json
│   │
│   ├── web/              # 前端 Web 应用 (React + Vite)
│   │   ├── src/
│   │   │   ├── components/    # React 组件
│   │   │   ├── pages/         # 页面组件
│   │   │   ├── hooks/         # 自定义 Hooks
│   │   │   ├── stores/        # 状态管理 (Zustand)
│   │   │   ├── utils/         # 工具函数
│   │   │   └── App.tsx        # 根组件
│   │   ├── public/            # 静态资源
│   │   └── package.json
│   │
│   ├── mobile/           # 移动端应用 (React Native)
│   └── worker/           # 后台任务处理器
│
├── docker/               # Docker 配置文件
├── scripts/              # 开发脚本
│   ├── dev.sh            # 启动开发环境 ⭐
│   ├── dev-stop.sh       # 停止开发环境
│   └── test.sh           # 运行测试
│
├── .vscode/              # VSCode 配置
│   └── launch.json       # 调试配置
│
├── .env.development      # 开发环境变量 ⭐
├── docker-compose.test.yml   # 测试基础设施
├── docker-compose.yml        # 生产基础设施
└── docker-compose.prod.yml   # 生产部署配置
```

---

## 🔄 开发工作流

### 1. 启动开发环境

```bash
./scripts/dev.sh
```

脚本会自动：
- ✅ 启动 Docker 基础设施 (PostgreSQL + Redis + Qdrant)
- ✅ 等待服务就绪
- ✅ 启动 API 开发服务器 (支持热重载)
- ✅ 启动 Web 开发服务器 (支持热重载)
- ✅ 显示访问地址和日志

### 2. 进行开发

**修改 API 代码:**
```bash
# 编辑 packages/api/src/ 下的文件
# tsx watch 会自动重启服务
```

**修改 Web 代码:**
```bash
# 编辑 packages/web/src/ 下的文件
# Vite 会自动刷新浏览器 (HMR)
```

### 3. 查看日志

```bash
# 实时查看 API 日志
tail -f logs/api.log

# 实时查看 Web 日志
tail -f logs/web.log

# 同时查看两个日志
tail -f logs/api.log logs/web.log
```

### 4. 数据库操作

```bash
# 进入 packages/api 目录
cd packages/api

# 运行数据库迁移
pnpm db:migrate

# 填充测试数据
pnpm db:seed
```

### 5. 停止开发环境

```bash
./scripts/dev-stop.sh
```

---

## 🐛 调试技巧

### VSCode 调试配置

项目已配置 `.vscode/launch.json`，提供以下调试选项：

| 配置名称 | 说明 | 快捷键 |
|----------|------|--------|
| 🔌 Debug API | 启动 API 并附加调试器 | F5 |
| 🔗 Attach to API | 附加到已运行的 API 进程 | - |
| 📱 Debug Web | 启动 Chrome 调试 Web 应用 | - |
| 🚀 Full Stack | 同时调试 API 和 Web | - |
| 🧪 Test API | 运行 API 测试 | - |
| 🔍 Debug Current Test | 调试当前测试文件 | - |

### 使用调试器

1. **在代码中设置断点** - 点击行号左侧
2. **选择调试配置** - 点击运行和调试图标 (Ctrl+Shift+D)
3. **启动调试** - 按 F5 或点击绿色播放按钮
4. **查看变量** - 在调试面板查看变量值
5. **单步执行** - 使用 F10 (跳过) / F11 (进入)

### API 调试技巧

```typescript
// 在代码中添加 debugger 语句
debugger; // 执行到这里会暂停

// 或使用 console.log 调试
console.log('DEBUG:', { user, data });
```

### Web 调试技巧

- **React DevTools** - 安装浏览器扩展检查组件树
- **Network 面板** - 查看 API 请求和响应
- **Console** - 查看日志和错误
- **Source 面板** - 设置断点调试

### 使用 Swagger UI 测试 API

访问 http://localhost:3000/api/docs 可以：
- 查看所有 API 端点
- 直接测试 API 请求
- 查看请求/响应格式

---

## 🔧 常见问题排查

### Docker 服务无法启动

```bash
# 检查 Docker 是否运行
docker info

# 检查端口是否被占用
lsof -i :5433  # PostgreSQL
lsof -i :6380  # Redis
lsof -i :6334  # Qdrant

# 停止占用端口的进程
kill -9 <PID>

# 重启 Docker
docker compose -f docker-compose.test.yml down
docker compose -f docker-compose.test.yml up -d
```

### API 无法连接数据库

```bash
# 检查数据库是否运行
docker ps | grep postgres

# 测试数据库连接
psql -h localhost -p 5433 -U admin -d collab_comments_test

# 检查环境变量
cat .env.development | grep DATABASE_URL
```

### 热重载不工作

**API:**
```bash
# 检查 tsx 是否正常运行
ps aux | grep tsx

# 重启 API 服务
./scripts/dev-stop.sh
./scripts/dev.sh
```

**Web:**
```bash
# 清除 Vite 缓存
rm -rf packages/web/node_modules/.vite

# 重新安装依赖
cd packages/web && pnpm install
```

### 端口冲突

```bash
# 查找占用端口的进程
lsof -i :3000  # API
lsof -i :5173  # Web

# 修改端口 (在 .env.development 中)
PORT=3001
```

### 依赖问题

```bash
# 清除所有 node_modules 并重新安装
rm -rf node_modules packages/*/node_modules
pnpm install
```

### 数据库迁移失败

```bash
# 重置测试数据库
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d

# 重新运行迁移
cd packages/api
pnpm db:migrate
```

---

## 🧪 测试运行方法

### 运行所有测试

```bash
# 从项目根目录
./scripts/test.sh

# 或在 API 包内
cd packages/api
pnpm test
```

### 运行单个测试文件

```bash
cd packages/api
pnpm test tests/auth.test.ts
```

### 监听模式 (持续测试)

```bash
cd packages/api
pnpm test:watch
```

### 生成测试覆盖率报告

```bash
cd packages/api
pnpm test -- --coverage
```

### 测试工作流

1. **编写测试** - 在 `packages/api/tests/` 或 `packages/web/src/**/*.test.tsx`
2. **运行测试** - `pnpm test`
3. **查看结果** - 终端显示通过/失败状态
4. **调试失败** - 使用 `pnpm test:watch` 或 VSCode 调试器

---

## 📚 其他资源

- [README.md](./README.md) - 项目概述
- [LOCAL_TESTING.md](./LOCAL_TESTING.md) - 本地测试指南
- [TESTING.md](./TESTING.md) - 测试策略
- [SECURITY_MIGRATION.md](./SECURITY_MIGRATION.md) - 安全迁移指南

---

## 💡 提示

- **使用 `.env.development`** - 不要硬编码配置
- **经常提交代码** - 小步快跑，频繁提交
- **编写测试** - 确保代码质量
- **查看日志** - 问题排查的第一步
- **使用调试器** - 比 console.log 更高效

---

**🎉 祝开发愉快！**

如有问题，请查看常见问题排查部分或联系团队。
