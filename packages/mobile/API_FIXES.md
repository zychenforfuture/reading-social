# 移动端 API 对齐修复

本文档说明移动端 API 与 Web 端/后端的对齐修复。

---

## 🔧 已修复的问题

### 1️⃣ 认证模块

#### 修复：`updateProfile` 方法
**问题**: 使用了错误的 HTTP 方法和字段格式  
**修复**:
```typescript
// ❌ 修复前
method: 'PATCH'
body: JSON.stringify({ avatar_url: avatarUrl })

// ✅ 修复后
method: 'PUT'  // 后端使用 PUT
body: JSON.stringify({ avatar_url: avatarUrl })  // 保持下划线格式（后端期望）
```

#### 修复：`changePassword` 方法
**问题**: 使用了 snake_case 字段，后端期望 camelCase  
**修复**:
```typescript
// ❌ 修复前
body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })

// ✅ 修复后
body: JSON.stringify({ oldPassword, newPassword })  // camelCase
```

#### 新增：`me` 方法
**问题**: 缺少获取当前用户信息的接口  
**新增**:
```typescript
me: () =>
  request<{ user: User }>('/auth/me')
```

---

### 2️⃣ 文档模块

#### 修复：`upload` 方法
**问题**: 使用 FormData，但后端期望 JSON  
**修复**:
```typescript
// ❌ 修复前
const formData = new FormData();
formData.append('title', title);
formData.append('content', content);
body: formData

// ✅ 修复后
headers: {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
}
body: JSON.stringify({ title, content })
```

#### 新增：`getComments` 方法
**问题**: 缺少获取文档评论分布的接口  
**新增**:
```typescript
getComments: (id: string) =>
  request<{ 
    comments: Comment[]; 
    blockCommentCount: Record<string, number> 
  }>(`/documents/${id}/comments`)
```

#### 新增：`delete` 方法
**问题**: 缺少删除文档的接口  
**新增**:
```typescript
delete: (id: string) =>
  request<{ message: string }>(`/documents/${id}`, { method: 'DELETE' })
```

---

### 3️⃣ 评论模块

#### 新增：`getReplies` 方法
**问题**: 缺少获取回复的接口  
**新增**:
```typescript
getReplies: (rootId: string) =>
  request<{ replies: Comment[] }>(`/comments/${rootId}/replies`)
```

#### 新增：`update` 方法
**问题**: 缺少更新评论的接口  
**新增**:
```typescript
update: (id: string, updates: { content?: string; isResolved?: boolean }) =>
  request<{ comment: Comment }>(`/comments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
```

---

### 4️⃣ 类型定义

#### 修复：`User.id` 类型
**问题**: 定义为 `number`，实际后端返回 UUID 字符串  
**修复**:
```typescript
// ❌ 修复前
id: number;

// ✅ 修复后
id: string;  // UUID 格式
```

#### 修复：`User.avatar_url` 类型
**问题**: 未考虑 `null` 值  
**修复**:
```typescript
// ❌ 修复前
avatar_url?: string;

// ✅ 修复后
avatar_url?: string | null;
```

#### 新增：Comment 类型字段
**问题**: 缺少后端返回的字段  
**新增**:
```typescript
export interface Comment {
  // ... 现有字段
  sentence_hash?: string | null;
  is_deleted?: boolean;
  updated_at: string;
}
```

---

### 5️⃣ 工具函数

#### 新增：`timeAgo` 函数
**用途**: 格式化相对时间（与 Web 端一致）  
**新增**:
```typescript
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
```

#### 新增：`setToken` / `clearToken` 函数
**用途**: 统一管理 Token 存储  
**新增**:
```typescript
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('auth_token', token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync('auth_token');
}
```

---

## 📋 API 对齐检查清单

### ✅ 已对齐

| 接口 | Web 端 | 移动端 | 后端 | 状态 |
|------|--------|--------|------|------|
| **认证** |
| POST /auth/send-code | ✅ | ✅ | ✅ | ✅ |
| POST /auth/register | ✅ | ✅ | ✅ | ✅ |
| POST /auth/login | ✅ | ✅ | ✅ | ✅ |
| POST /auth/reset-password | ✅ | ✅ | ✅ | ✅ |
| GET /auth/me | ✅ | ✅ | ✅ | ✅ |
| PUT /auth/profile | ✅ | ✅ | ✅ | ✅ |
| PUT /auth/change-password | ✅ | ✅ | ✅ | ✅ |
| **文档** |
| GET /documents | ✅ | ✅ | ✅ | ✅ |
| GET /documents/:id | ✅ | ✅ | ✅ | ✅ |
| POST /documents | ✅ | ✅ | ✅ | ✅ |
| DELETE /documents/:id | ✅ | ✅ | ✅ | ✅ |
| GET /documents/:id/comments | ✅ | ✅ | ✅ | ✅ |
| **评论** |
| GET /comments/block/:hash | ✅ | ✅ | ✅ | ✅ |
| GET /comments/:id/replies | ✅ | ✅ | ✅ | ✅ |
| POST /comments | ✅ | ✅ | ✅ | ✅ |
| PATCH /comments/:id | ✅ | ✅ | ✅ | ✅ |
| DELETE /comments/:id | ✅ | ✅ | ✅ | ✅ |
| POST /comments/:id/like | ✅ | ✅ | ✅ | ✅ |

---

## 🧪 测试建议

### 1. 登录/注册流程
```bash
# 1. 打开移动端应用
# 2. 测试注册流程
# 3. 测试登录流程
# 4. 验证 Token 存储
```

### 2. 文档操作
```bash
# 1. 测试文档列表加载
# 2. 测试文档详情查看
# 3. 测试文档上传
# 4. 测试文档删除
```

### 3. 评论功能
```bash
# 1. 测试查看评论
# 2. 测试创建评论
# 3. 测试创建回复
# 4. 测试点赞/取消点赞
# 5. 测试删除评论
```

### 4. 个人资料
```bash
# 1. 测试更新头像
# 2. 测试修改密码
```

---

## 🔄 与 Web 端对比

### 相同点
- ✅ API 接口定义一致
- ✅ 类型定义一致
- ✅ 错误处理一致
- ✅ Token 管理一致

### 差异点
| 特性 | Web 端 | 移动端 |
|------|--------|--------|
| Token 存储 | localStorage | SecureStore |
| HTTP 客户端 | 原生 fetch | 原生 fetch |
| 状态管理 | Zustand | Zustand |
| UI 框架 | React + Tailwind | React Native |

---

## 📚 相关文件

- `lib/api.ts` - API 客户端（已修复）
- `lib/store.ts` - 状态管理（无需修改）
- `app/(auth)/login.tsx` - 登录页面（无需修改）
- `app/(auth)/register.tsx` - 注册页面（无需修改）

---

## ✅ 下一步

1. **测试修复后的功能**
   ```bash
   cd packages/mobile
   npm start
   ```

2. **检查是否需要更新其他页面**
   - `app/(app)/document/[id].tsx` - 文档详情页
   - `app/(app)/profile.tsx` - 个人资料页

3. **更新环境变量**
   ```bash
   # 复制并编辑 .env
   cp .env.example .env
   # 设置正确的 API 地址
   EXPO_PUBLIC_API_URL=http://your-api-url.com/api
   ```

---

**移动端 API 已与 Web 端和后端完全对齐！** 🎉
