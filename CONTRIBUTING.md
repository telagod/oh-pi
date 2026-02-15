# 贡献指南 | Contributing Guide

感谢你对 oh-pi 的关注！欢迎任何形式的贡献。

Thank you for your interest in oh-pi! Contributions of all kinds are welcome.

## 开发环境 | Development Setup

```bash
git clone https://github.com/telagod/oh-pi.git
cd oh-pi
npm install
npm run build
```

## 提交规范 | Commit Convention

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

| 前缀 | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档变更 |
| `refactor` | 重构（不改变行为） |
| `test` | 添加或修改测试 |
| `chore` | 构建、依赖等杂项 |

示例：

```
feat: add support for new provider
fix: resolve race condition in ant colony
docs: update README with new examples
```

## 分支策略 | Branch Strategy

- `main` — 稳定分支，禁止 force push
- 功能分支从 `main` 创建，命名格式：`feat/xxx`、`fix/xxx`、`docs/xxx`
- 通过 Pull Request 合并，至少需要一次 review

## Pull Request 流程

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 提交你的修改（遵循提交规范）
4. 确保代码能正常构建：`npm run build`
5. 推送并创建 PR

### PR 要求

- 标题遵循 Conventional Commits 格式
- 描述清楚改动内容和原因
- 一个 PR 只解决一个问题
- 不要包含无关的代码变更

## 代码规范 | Code Style

- 遵循项目现有风格
- 使用有意义的变量名
- 函数不超过 50 行
- 仅在复杂逻辑处添加注释
- 不要硬编码密钥或敏感信息
- 显式处理错误，不要静默失败

## 报告问题 | Reporting Issues

请使用 [Issue 模板](https://github.com/telagod/oh-pi/issues/new/choose) 提交问题，包含：

- 清晰的问题描述
- 复现步骤
- 预期行为与实际行为
- 环境信息（OS、Node.js 版本等）

## 许可证 | License

提交贡献即表示你同意你的代码以 [MIT](./LICENSE) 许可证发布。
