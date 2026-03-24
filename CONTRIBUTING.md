# 贡献指南

感谢你对共鸣阅读项目的关注！我们欢迎各种形式的贡献，包括但不限于：

- 提交 Bug 报告
- 建议新功能
- 改进文档
- 提交代码修复或新功能

## 如何提交 Issue

### Bug 报告

提交 Bug 报告时，请尽可能提供以下信息：

1. **问题描述**：清晰描述发生了什么
2. **复现步骤**：如何一步步复现这个问题
3. **期望行为**：你期望发生什么
4. **实际行为**：实际发生了什么
5. **环境信息**：
   - 操作系统
   - 浏览器版本（如果是 Web 端问题）
   - Node.js 版本
   - 项目版本/分支
6. **截图或录屏**（如有）

### 功能请求

建议新功能时，请说明：

1. **使用场景**：这个功能解决了什么问题
2. **预期行为**：你希望这个功能如何工作
3. **可能的实现方案**（可选）

## 如何提交 Pull Request

### 准备工作

1. **Fork 仓库**：点击 GitHub 页面的 Fork 按钮
2. **克隆你的 Fork**：
   ```bash
   git clone https://github.com/yourusername/resonant-reading.git
   cd resonant-reading
   ```
3. **添加上游仓库**：
   ```bash
   git remote add upstream https://github.com/original-owner/resonant-reading.git
   ```

### 开发流程

1. **创建分支**：
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/bug-description
   ```

   分支命名规范：
   - `feature/` - 新功能
   - `fix/` - Bug 修复
   - `docs/` - 文档更新
   - `refactor/` - 代码重构
   - `test/` - 测试相关

2. **安装依赖并启动开发环境**：
   ```bash
   pnpm install
   pnpm run dev:all
   ```

3. **编写代码**：
   - 遵循现有代码风格
   - 添加必要的注释
   - 确保代码通过 ESLint 检查

4. **运行测试**：
   ```bash
   pnpm test
   ```

5. **提交变更**：
   ```bash
   git add .
   git commit -m "feat: add something"
   ```

### Commit Message 规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式（不影响功能）
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

示例：
```
feat: add dark mode support
fix: resolve comment sync issue in Safari
docs: update deployment guide
```

### 提交 PR

1. **推送到你的 Fork**：
   ```bash
   git push origin feature/your-feature-name
   ```

2. **创建 Pull Request**：
   - 在 GitHub 页面点击 "New Pull Request"
   - 选择你的分支和上游仓库的目标分支
   - 填写 PR 描述，说明变更内容和原因

3. **PR 描述模板**：
   ```markdown
   ## 变更内容
   简要描述这次 PR 做了什么

   ## 相关 Issue
   关联的 Issue 编号（如有）
   Fixes #123

   ## 测试
   - [ ] 本地测试通过
   - [ ] 新增测试用例（如适用）
   - [ ] 文档已更新（如适用）

   ## 截图（如适用）
   如果是 UI 变更，请提供截图
   ```

4. **Code Review**：
   - 维护者会 Review 你的代码
   - 可能需要根据反馈进行修改
   - 所有 CI 检查必须通过

## 代码规范

### 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS
- **后端**：Express.js + PostgreSQL + Redis
- **移动端**：Expo + React Native
- **测试**：Vitest + Testing Library

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 提交前运行代码检查：
  ```bash
  pnpm lint
  pnpm format
  ```

### 测试要求

- 新功能必须包含测试
- Bug 修复建议添加回归测试
- 测试覆盖率不降低

### 文件组织

```
packages/
├── api/           # 后端 API
│   ├── src/
│   │   ├── routes/      # API 路由
│   │   ├── services/    # 业务逻辑
│   │   ├── middleware/  # 中间件
│   │   └── __tests__/   # 测试文件
├── web/           # Web 前端
│   └── src/
│       ├── pages/       # 页面组件
│       ├── components/  # 组件
│       └── lib/         # 工具函数
├── worker/        # 后台任务
└── mobile/        # 移动端
```

## 开发环境设置

详细开发环境设置请参考 [开发文档](./docs/development.md)。

快速开始：

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/resonant-reading.git
cd resonant-reading

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写必要配置

# 4. 启动开发环境
pnpm run dev:all
```

## 文档贡献

文档贡献同样重要！你可以：

- 改进现有文档的清晰度
- 修复文档中的错误
- 添加缺失的文档
- 翻译文档（未来计划）

文档位于：
- 根目录：`README.md`, `FAQ.md`, `LANDING.md`
- `docs/` 目录：开发、测试、部署文档
- 各 `packages/` 目录下的 README.md

## 社区行为准则

- 尊重所有参与者
- 接受建设性的批评
- 关注对社区最有利的事情
- 友善对待新手

## 获取帮助

如果你在贡献过程中遇到问题：

- 查看 [开发文档](./docs/development.md)
- 查看 [FAQ](./FAQ.md)
- 在 Issue 中提问
- 发送邮件至：support@resonant.reading

## 许可证

通过提交 PR，你同意你的代码将以 MIT 许可证开源。

---

再次感谢你的贡献！🙏
