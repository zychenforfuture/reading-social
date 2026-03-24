# 共鸣阅读 - 移动端

基于 Expo + React Native 的移动端应用，提供跨平台的阅读与批注体验。

## 功能特性

### 已实现 ✅

- **用户认证**
  - 邮箱注册与登录
  - 验证码验证
  - 密码重置
  - Token 持久化存储（SecureStore）

- **文档阅读**
  - 文档列表浏览
  - 文档详情查看
  - 章节导航
  - 阅读进度记录

- **评论互动**
  - 查看段落评论
  - 发表评论和回复
  - 点赞/取消点赞
  - 评论实时同步

- **个人中心**
  - 头像上传与更新
  - 用户名修改
  - 密码修改
  - 个人资料查看

### 开发中 ⏳

- **通知中心**
  - 评论回复通知
  - 点赞通知
  - 通知列表与已读状态

- **阅读设置**
  - 字号调节
  - 主题切换
  - 行距调整

- **跨文档聚合**
  - 同内容批注聚合展示
  - 多文档内容关联

## 技术栈

- [Expo](https://expo.dev/) - React Native 开发框架
- [React Native](https://reactnative.dev/) - 跨平台移动应用框架
- [TypeScript](https://www.typescriptlang.org/) - 类型安全
- [Zustand](https://github.com/pmndrs/zustand) - 状态管理
- [TanStack Query](https://tanstack.com/query) - 服务端状态管理
- [React Navigation](https://reactnavigation.org/) - 路由导航

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode (Mac only)
- Android: Android Studio + Android SDK

### 安装依赖

```bash
# 在项目根目录安装所有依赖
pnpm install

# 或单独安装移动端依赖
cd packages/mobile
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置 API 地址：

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

### 启动开发服务器

```bash
# 方式 1：使用项目脚本（推荐）
pnpm run dev:mobile

# 方式 2：直接启动
cd packages/mobile
pnpm start
```

启动后，按提示选择：
- `i` - 在 iOS 模拟器运行
- `a` - 在 Android 模拟器运行
- `w` - 在 Web 浏览器运行
- 扫描 QR 码 - 在物理设备运行（需 Expo Go App）

## 项目结构

```
packages/mobile/
├── app/                      # 路由页面（Expo Router）
│   ├── (auth)/              # 认证路由组
│   │   ├── login.tsx        # 登录页
│   │   ├── register.tsx     # 注册页
│   │   └── _layout.tsx      # 认证布局
│   ├── (app)/               # 主应用路由组
│   │   ├── (tabs)/          # 底部标签页
│   │   │   ├── index.tsx    # 首页（文档列表）
│   │   │   ├── profile.tsx  # 个人中心
│   │   │   └── _layout.tsx  # 标签布局
│   │   ├── document/        # 文档相关
│   │   │   └── [id].tsx     # 文档详情页
│   │   └── _layout.tsx      # 主应用布局
│   └── _layout.tsx          # 根布局
├── components/              # 可复用组件
├── lib/                     # 工具库
│   ├── api.ts              # API 客户端
│   └── store.ts            # Zustand 状态管理
├── assets/                  # 静态资源
│   ├── images/
│   └── fonts/
├── app.json                # Expo 配置
└── package.json
```

## API 集成

移动端使用与 Web 端相同的 API，详见 [API_FIXES.md](./API_FIXES.md) 了解移动端特定的 API 适配。

### 主要 API 模块

- **认证** - `/auth/*`
- **文档** - `/documents/*`
- **评论** - `/comments/*`
- **通知** - `/notifications/*`

## 开发指南

### 代码规范

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- 状态管理优先使用 Zustand
- 服务端状态使用 TanStack Query

### 调试技巧

```bash
# 查看日志
pnpm start --ios --verbose

# 清除缓存
expo start -c

# 重新安装依赖
rm -rf node_modules && pnpm install
```

### 真机调试

1. 安装 Expo Go App（iOS App Store / Android Play Store）
2. 确保手机和电脑在同一 WiFi 网络
3. 启动开发服务器后扫描终端显示的 QR 码

## 构建与发布

### 预览版构建

```bash
# 构建 iOS 预览版
eas build --platform ios --profile preview

# 构建 Android 预览版
eas build --platform android --profile preview
```

### 生产版构建

```bash
# 配置 EAS
eas login
eas configure

# 构建生产版
eas build --platform all --profile production
```

## 待办事项

### 高优先级

- [ ] 实现通知中心页面
- [ ] 添加阅读设置面板
- [ ] 优化大文档加载性能
- [ ] 添加离线缓存支持

### 中优先级

- [ ] 深色模式支持
- [ ] 批量操作（批量删除文档）
- [ ] 搜索功能
- [ ] 分享功能

### 低优先级

- [ ] 生物识别登录（Face ID / 指纹）
- [ ] 推送通知
- [ ] 小组件支持

## 常见问题

### Q: 如何在模拟器中访问本地 API？

A: 使用特殊地址：
- iOS Simulator: `http://localhost:3000/api`
- Android Emulator: `http://10.0.2.2:3000/api`
- 真机: 使用电脑局域网 IP

### Q: 构建失败怎么办？

A: 尝试以下步骤：
1. 清除缓存：`expo start -c`
2. 删除 node_modules 重新安装
3. 检查 Expo CLI 版本：`expo --version`
4. 查看 [Expo 构建文档](https://docs.expo.dev/build/introduction/)

### Q: 如何更新 API 类型定义？

A: 当后端 API 变更时，同步更新：
1. `lib/api.ts` - API 客户端方法
2. `lib/store.ts` - 状态类型
3. 相关组件的类型定义

## 相关文档

- [API 修复记录](./API_FIXES.md) - 移动端 API 适配详情
- [开发文档](../../docs/development.md) - 整体开发指南
- [后端 API 文档](../../packages/api/) - 服务端接口

## 许可证

MIT License © 2026 共鸣阅读
