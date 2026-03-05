# 沉浸式预览高成本路线 Spike 进展

日期：2026-03-05  
对应计划：`../plan/immersive-preview-high-cost-spike-plan.md`

## 当前状态

- 状态：进行中（D1-D3 已完成，D4 待开始）
- 里程碑：D4 兼容性抽测

## 每日进展

### D1

- 结果：已完成
- 备注：
  - 已新增实验开关：`markdownToolkit.experimental.immersiveReadonlyViewer`（默认关闭）。
  - 已增加最小 custom readonly viewer：`markdownToolkit.markdownReadonlyViewer`，可打开 `.md`。
  - 已增加“回到源码编辑”命令：`markdownToolkit.switchToSourceEditor`（含标题栏/右键入口）。
  - 已完成编译验证：`npm run compile` 通过。

### D2

- 结果：已完成
- 备注：
  - 已新增 viewer 内可见入口：webview 顶部“切回源码编辑”按钮（1 次点击触发切回）。
  - 已补齐命令面板入口：`markdownToolkit.openReadonlyViewer` 在无上下文时可弹出文件选择器打开 `.md`。
  - 实验开关开启后继续通过 `workbench.editorAssociations` 关联 `*.md -> markdownToolkit.markdownReadonlyViewer`，覆盖 Explorer / Quick Open / 最近文件 / 命令面板“打开文件”链路。
  - 已完成编译验证：`npm run compile` 通过。
  - Extension Development Host 手测通过：4 类入口落点一致，且“回到源码编辑 <= 1 次操作”。

### D3

- 结果：已完成
- 备注：
  - 已新增固定采样命令：`markdownToolkit.runImmersiveReadonlyViewerSpikeBenchmark`。
  - 采样口径固定为：10 个 Markdown 文件连续切换 3 轮（30 个样本，29 个连续切换样本）。
  - 本轮采样记录：`../benchmark/1.txt`（开始时间：2026-03-05T08:42:38.622Z）。
  - Readonly Viewer：`first=132ms`、`switch p50=29ms`、`switch p95=39.6ms`。
  - Baseline（source + openWith preview）：`first=568ms`、`switch p50=99ms`、`switch p95=138.2ms`。
  - 对比结论：Readonly 相比 Baseline，`first=-76.76%`、`switch p95=-71.35%`。
  - 已完成编译验证：`npm run compile` 通过。

### D4

- 结果：待开始
- 备注：—

### D5

- 结果：待开始
- 备注：—

## 风险与阻塞

- 风险：实验开关开启后会写入 `workbench.editorAssociations` 的 `*.md` 映射；需在 D2 验证与用户现有 editor association 的兼容性。
