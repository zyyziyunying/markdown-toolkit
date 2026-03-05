# 沉浸式预览高成本路线 Spike 进展

日期：2026-03-05  
对应计划：`../plan/immersive-preview-high-cost-spike-plan.md`

## 当前状态

- 状态：进行中（D1 已完成）
- 里程碑：D2 入口与交互闭环

## 每日进展

### D1

- 结果：已完成
- 备注：
  - 已新增实验开关：`markdownToolkit.experimental.immersiveReadonlyViewer`（默认关闭）。
  - 已增加最小 custom readonly viewer：`markdownToolkit.markdownReadonlyViewer`，可打开 `.md`。
  - 已增加“回到源码编辑”命令：`markdownToolkit.switchToSourceEditor`（含标题栏/右键入口）。
  - 已完成编译验证：`npm run compile` 通过。

### D2

- 结果：待开始
- 备注：—

### D3

- 结果：待开始
- 备注：—

### D4

- 结果：待开始
- 备注：—

### D5

- 结果：待开始
- 备注：—

## 风险与阻塞

- 风险：实验开关开启后会写入 `workbench.editorAssociations` 的 `*.md` 映射；需在 D2 验证与用户现有 editor association 的兼容性。
