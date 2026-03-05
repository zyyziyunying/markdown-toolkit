# `src/extension.ts` 拆分重构进展

日期：2026-03-05  
对应计划：`../plan/extension-ts-split-plan.md`

## 当前状态

- 状态：进行中（代码拆分已完成并通过编译，手工 smoke 待执行）
- 里程碑：完成首轮模块化落地（入口装配 + 职责拆分）

## 本次完成内容

- 已将入口瘦身：`src/extension.ts` 仅保留激活入口与注册装配（当前 126 行）。
- 已拆分共享层：
  - `src/shared/constants.ts`
  - `src/shared/types.ts`
- 已拆分运行态管理：
  - `src/state/runtimeState.ts`
- 已拆分 readonly viewer 相关模块：
  - `src/readonlyViewer/provider.ts`
  - `src/readonlyViewer/fallbackRenderer.ts`
  - `src/readonlyViewer/webviewUtils.ts`
  - `src/readonlyViewer/configSync.ts`
- 已拆分 preview 与 benchmark：
  - `src/preview/previewCommands.ts`
  - `src/preview/groupReuse.ts`
  - `src/benchmark/spikeBenchmark.ts`

## 与计划对照

- P1（shared/state）：已完成
- P2（readonly viewer）：已完成
- P3（preview/group reuse）：已完成
- P4（benchmark/config sync）：已完成
- P5（瘦身 activate）：已完成

## 验证记录

- 已执行：`npm run compile`
- 结果：通过（无 TypeScript 错误）

## 待执行项

1. 在 Extension Development Host 手工 smoke：
   - open preview in place
   - open floating preview
   - exit preview in place
   - open readonly viewer
   - switch to source editor
2. 若开启渲染模式，补测 Mermaid 交互（缩放/拖拽/focus/reset）。

## 风险与关注点

- 本轮重构涉及跨模块依赖重连，虽然编译通过，仍需通过手工行为回归确认无命令/事件绑定遗漏。
- 运行态从文件级变量改为 `runtimeState` 对象管理，后续新增功能需统一走状态模块，避免再次分散。
