# 安全迁移指南 - JWT 鉴权 + bcrypt 密码哈希

本文档说明如何将系统从开发态的 `dummy_token` 鉴权迁移到生产级的 JWT + bcrypt 实现。

## 📋 变更概览

### 已实现功能

1. **JWT 鉴权** - 使用 `jsonwebtoken` 库签发和验证 token
2. **bcrypt 密码哈希** - 使用 `bcryptjs` 进行密码加密存储
3. **中间件系统** - 新增 `packages/api/src/middleware/auth.ts`
4. **路由保护** - 所有需要鉴权的路由已更新

### 新增文件

```
packages/api/src/
├── middleware/
│   └── auth.ts              # JWT 生成、验证、权限控制中间件
└── scripts/
    ├── migrate-passwords.ts # 密码迁移脚本（旧 → bcrypt）
    └── test-auth.ts         # JWT 功能测试脚本
```

### 修改文件

- `packages/api/src/routes/auth.ts` - 完整重写，使用 bcrypt + JWT
- `packages/api/src/routes/document.ts` - 替换 dummy_token 为 authenticate 中间件
- `packages/api/src/routes/comment.ts` - 替换 dummy_token 为 authenticate 中间件
- `packages/api/package.json` - 新增迁移和测试脚本
- `.env.production.example` - 更新 JWT_SECRET 说明

---

## 🚀 迁移步骤

### 1️⃣ 本地开发环境迁移

```bash
cd /Users/chenzhenyu/reading

# 1. 安装依赖（已安装可跳过）
pnpm install

# 2. 运行 JWT 测试，确认功能正常
pnpm --filter @collab/api test-auth

# 3. 编译 TypeScript
pnpm --filter @collab/api build

# 4. 重启 API 服务
pnpm --filter @collab/api dev
```

### 2️⃣ 数据库密码迁移（现有用户）

如果数据库中已有使用 `$hashed$` 前缀的用户密码，需要迁移为 bcrypt 哈希：

```bash
# 确保 API 服务未运行（避免数据库连接冲突）
# 然后运行迁移脚本
pnpm --filter @collab/api migrate-passwords
```

**迁移脚本会：**
- 查找所有 `password_hash LIKE '$hashed$%'` 的用户
- 提取明文密码（去掉 `$hashed$` 前缀）
- 使用 bcrypt 重新哈希
- 更新到数据库

**预期输出：**
```
🚀 Starting password migration...
📦 Found 3 users with legacy password hashes
✅ Migrated: admin@example.com (admin)
✅ Migrated: user@example.com (user)
=================================
Migration Complete!
✅ Successfully migrated: 2
❌ Failed: 0
=================================
```

### 3️⃣ 生产环境部署

```bash
# 1. 复制并编辑环境变量文件
cp .env.production.example .env.production

# 2. 编辑 .env.production，设置强密码和 JWT_SECRET
# JWT_SECRET 生成方法：
openssl rand -base64 32

# 3. 重新构建并部署
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 4. 运行密码迁移（在容器内）
docker exec -it collab-api pnpm migrate-passwords
```

---

## 🔑 API 变更说明

### 登录接口 (`POST /api/auth/login`)

**请求：**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**响应（成功后）：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ...[截断]",
  "user": {
    "id": "uuid...",
    "email": "user@example.com",
    "username": "用户名",
    "avatar_url": "https://...",
    "is_admin": false
  }
}
```

**Token 特性：**
- 有效期：7 天
- 格式：`Bearer <token>`
- 自动过期，过期后需重新登录

### 鉴权接口

所有需要登录的接口现在使用 `Authorization` header：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**受保护的接口：**
- `GET /api/documents` - 获取用户文档列表
- `POST /api/documents` - 上传文档
- `DELETE /api/documents/:id` - 删除文档
- `POST /api/comments` - 创建评论
- `PATCH /api/comments/:id` - 更新评论
- `DELETE /api/comments/:id` - 删除评论
- `POST /api/comments/:id/like` - 点赞/取消点赞
- `GET /api/auth/me` - 获取当前用户信息
- `PUT /api/auth/profile` - 更新个人资料
- `PUT /api/auth/change-password` - 修改密码

---

## 🧪 测试验证

### 1. 测试登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'
```

### 2. 测试受保护接口

```bash
# 使用返回的 token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3000/api/documents \
  -H "Authorization: Bearer $TOKEN"
```

### 3. 测试无效 token

```bash
curl -X GET http://localhost:3000/api/documents \
  -H "Authorization: Bearer invalid_token"
# 应返回 401 Unauthorized
```

---

## 🔒 安全最佳实践

### JWT_SECRET 管理

- ✅ 使用至少 32 字符的随机字符串
- ✅ 生产环境必须修改默认值
- ✅ 不要提交到版本控制
- ✅ 定期轮换（需使旧 token 失效）

**生成强密钥：**
```bash
# 方法 1: OpenSSL
openssl rand -base64 32

# 方法 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 密码策略

当前实现：
- ✅ 最小长度：6 字符（注册时验证）
- ✅ bcrypt 哈希（salt rounds: 10）
- ⚠️ 建议增强：密码复杂度要求（大小写 + 数字 + 符号）

### 后续安全加固建议

1. **Token 刷新机制** - 使用 refresh token 延长会话
2. **速率限制** - 登录接口增加防暴力破解
3. **HTTPS 强制** - 生产环境必须启用
4. **CORS 配置** - 限制允许的源
5. **审计日志** - 记录敏感操作（登录、密码修改等）

---

## 🐛 故障排查

### 问题 1: 登录后接口返回 401

**可能原因：**
- JWT_SECRET 在登录和请求时不一致
- Token 格式错误（缺少 `Bearer ` 前缀）
- Token 已过期

**解决方法：**
```bash
# 检查 .env.production 中的 JWT_SECRET
docker exec -it collab-api env | grep JWT_SECRET

# 重新登录获取新 token
curl -X POST http://localhost:3000/api/auth/login ...
```

### 问题 2: 密码迁移失败

**可能原因：**
- 数据库连接失败
- 用户密码格式不是 `$hashed$` 前缀

**解决方法：**
```bash
# 手动检查密码格式
docker exec -it collab-postgres psql -U admin -d collab_comments \
  -c "SELECT id, email, password_hash FROM users LIMIT 5;"

# 如果已经是 bcrypt 格式（$2b$...），无需迁移
```

### 问题 3: 编译错误

```bash
# 清理并重新编译
cd packages/api
rm -rf dist
pnpm run build
```

---

## 📚 相关文档

- [README.md](./README.md) - 项目总览
- [.env.production.example](./.env.production.example) - 环境变量模板
- [packages/api/src/middleware/auth.ts](./packages/api/src/middleware/auth.ts) - 鉴权中间件源码

---

## ✅ 迁移检查清单

- [ ] 本地编译通过 (`pnpm build`)
- [ ] JWT 测试通过 (`pnpm test-auth`)
- [ ] 密码迁移完成（现有用户）
- [ ] 生产环境变量配置（JWT_SECRET 已修改）
- [ ] Docker 容器重建
- [ ] 登录功能测试通过
- [ ] 文档上传测试通过
- [ ] 评论功能测试通过
- [ ] 旧 token 已失效（重新登录所有用户）

---

**迁移完成后，系统即具备生产级的鉴权安全性！** 🎉
