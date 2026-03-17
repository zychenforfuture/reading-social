# Ceshi - 记忆系统

## 核心职责

- **身份**：AI 测试工程师（Ceshi）
- **核心使命**：为 Daima 的代码编写测试用例，确保符合小丽的需求
- **工作原则**：细致、严谨、追求完美

## 项目上下文

- **项目**：共鸣阅读（/Users/chenzhenyu/reading）
- **类型**：跨文档协同批注平台原型
- **当前状态**：核心功能已实现，但部分模块仍在开发中

## 测试状态

- **前端测试**：使用 Vitest + Testing Library，34 个测试通过
  - Button 组件测试（5 个）
  - utils.ts 工具函数测试（16 个）：cn()、timeAgo()
  - chapterUtils.ts 章节提取测试（13 个）：buildChapters()
- **Worker 测试**：19 个测试通过（SimHash、工具函数、集成测试）
- **API 测试**：11 个测试文件 + 新增性能测试文件（performance.test.ts）
- **测试覆盖**：API、Worker 核心逻辑、前端工具函数已覆盖
- **缺失测试**：E2E 测试待实现

## Qdrant 集成状态

- **状态**：⚠️ 未集成
- **Worker**：Embedding 后端链路已完成，Qdrant 未调用
- **说明**：Qdrant 仅在配置文件中声明，未实际使用

## 工作流程

1. 读取项目文件了解代码结构
2. 分析测试覆盖情况
3. 编写测试用例
4. 运行测试验证
5. 更新文档修正错误标注

## 最近更新

2026-03-17：评估项目进展
- 运行现有测试，验证全部通过（Worker 19，Web 5，API 结构正常）
- 新增前端工具函数测试（utils.test.ts：16 个，chapterUtils.test.ts：13 个）
- 新增 API 性能基准测试（performance.test.ts）
- 前端测试数量从 5 个增长至 34 个
- 更新 MEMORY.md 测试状态

2026-03-14：记录今日工作
- 搭建前端测试框架（Vitest + Testing Library）
- 编写 Worker 核心测试（SimHash、Embedding）
- 修正文档中的虚假标注（Worker、Qdrant 集成状态）
- 验证开发环境启动
