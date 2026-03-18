# 共鸣阅读贡献指南

欢迎贡献代码、文档或反馈！请先快速浏览以下要求，确保你的修改能够顺利合并。

## 快速开始
1. 克隆仓库并安装依赖：
   ```bash
   pnpm install
   ```
2. 开发时建议使用项目自带脚本启动依赖和服务：
   ```bash
   ./scripts/dev.sh up
   # 或只启动依赖：./scripts/dev.sh infra
   ```
3. 提交前请运行测试（需要 Docker，自动拉起测试依赖）：
   ```bash
   pnpm test
   ```

## 代码与提交规范
- **分支**：以功能或修复命名，例如 `feat/comment-sse`、`fix/login-rate-limit`。
- **提交信息**：使用简洁的动词短语，如 `fix: handle jwt secret validation`。
- **类型安全**：保持 TypeScript 严格模式兼容，避免新增 `any`。
- **格式与风格**：遵循现有代码风格，必要时运行相关包的 `lint`/`format` 脚本。
- **测试**：修改 API/Worker 逻辑需补充或更新对应 Vitest 测试；文档修改可跳过，但请确保链接可用。

## Pull Request 清单
- [ ] 代码变更聚焦单一主题，删除无关的调试输出
- [ ] 新增/修改的功能附带测试或明确说明测试影响
- [ ] 文档和注释与实现保持一致（路径、命令、链接）
- [ ] 本地 `pnpm test` 通过，必要时补充 `pnpm --filter <pkg> lint`
- [ ] 说明破坏性变更或迁移步骤

感谢你的贡献！如有疑问，请通过 Issue 讨论。***
