# `src/extension.ts` 拆分重构计划

日期：2026-03-05  
来源：`../../src/extension.ts`

## 目标与约束

- [x] 目标：将 `src/extension.ts` 从 1500+ 行拆分为按职责分层的多文件结构，`extension.ts` 仅保留激活入口与装配逻辑。
- [ ] 约束：本轮只做结构重组，不改变用户可见行为与命令语义。
- [ ] 约束：每个阶段完成后必须 `npm run compile` 通过，再进入下一阶段。

## 目标目录结构

- [x] `src/shared/constants.ts`：命令 ID、配置 key、context key、阈值常量。
- [x] `src/shared/types.ts`：`ActiveMarkdownPreview`、benchmark 类型、配置类型等。
- [x] `src/state/runtimeState.ts`：运行态（immersive 开关、transition 锁、render mode override、preview memory）。
- [x] `src/readonlyViewer/provider.ts`：`MarkdownReadonlyDocument`、`MarkdownReadonlyViewerProvider`。
- [x] `src/readonlyViewer/fallbackRenderer.ts`：fallback markdown 渲染与 inline 渲染工具。
- [x] `src/readonlyViewer/configSync.ts`：实验态配置读取、context 同步、editor association 回写。
- [x] `src/preview/groupReuse.ts`：detached preview 记忆与 group 复用逻辑。
- [x] `src/preview/previewCommands.ts`：open in-place / floating / exit / switch to source / active editor changed。
- [x] `src/benchmark/spikeBenchmark.ts`：benchmark 采样、统计、输出汇总。

## 分阶段执行清单

## P0 基线与防回归准备

- [x] 标记当前 `src/extension.ts` 功能边界（只读 viewer、preview、benchmark、配置同步、激活注册）。
- [x] 建立手工 smoke checklist（in-place、floating、exit、readonly viewer、switch to source、配置开关变化）。

## P1 抽离 shared 与 state（低风险）

- [x] 抽离常量与类型到 `src/shared/*`。
- [x] 抽离运行态到 `src/state/runtimeState.ts`，避免跨模块隐式全局变量。
- [x] `src/extension.ts` 改为 import 使用，保证行为不变。

## P2 抽离 readonly viewer（最大块）

- [x] 迁移 `MarkdownReadonlyDocument` + `MarkdownReadonlyViewerProvider` 到 `src/readonlyViewer/provider.ts`。
- [x] 迁移 `renderMarkdownWithFallback`、`renderInlineMarkdown` 等到 `src/readonlyViewer/fallbackRenderer.ts`。
- [x] 保持 `switchToSourceEditor` 消息协议与 webview HTML 行为一致。

## P3 抽离 preview 命令与 group 复用

- [x] 迁移 preview group 复用逻辑到 `src/preview/groupReuse.ts`。
- [x] 迁移 `openPreviewInPlace`、`openFloatingPreview`、`exitPreviewInPlace`、`handleActiveTextEditorChanged` 到 `src/preview/previewCommands.ts`。
- [x] 保持 `immersive` 状态迁移与错误提示文案一致。

## P4 抽离 benchmark 与配置同步

- [x] 迁移 benchmark 逻辑到 `src/benchmark/spikeBenchmark.ts`。
- [x] 迁移实验开关与 editor association 同步逻辑到 `src/readonlyViewer/configSync.ts`。
- [x] 保持阈值判定、输出格式、命令入口不变。

## P5 瘦身 activate 入口

- [x] `src/extension.ts` 只保留：初始化 context、注册 provider、注册命令、注册配置监听、`deactivate`。
- [x] 将注册逻辑整理为清晰的装配函数（避免激活函数继续膨胀）。

## 验收标准

- [x] `npm run compile` 无 TypeScript 错误。
- [ ] 手工 smoke checklist 全通过。
- [ ] 只读 viewer 纯文本/渲染模式、Mermaid 交互行为不回退。
- [x] `src/extension.ts` 控制在约 150-250 行，模块边界清晰且可独立维护。

## 关联文档

- 进展记录：`../progress/extension-ts-split-progress.md`
