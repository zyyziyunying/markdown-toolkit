# 沉浸式预览高成本路线 Spike 进展

日期：2026-03-05  
对应计划：`../plan/immersive-preview-high-cost-spike-plan.md`

## 当前状态

- 状态：进行中（D1-D4 兼容性抽测已完成，D4 可选渲染验证待开始）
- 里程碑：D5 决策与收口

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

- 结果：兼容性抽测已完成（可选渲染验证待开始）
- 备注：
  - 已完成抽测报告：`./immersive-preview-high-cost-spike-d4-compatibility-smoke.md`。
  - 用户手测补充：确认“切回源码 <= 1 次操作”与“拆分右移”路径无异常，按当前口径将 D4 对应兼容性项视为通过。
  - 结论：无阻塞项；识别 1 个高风险（多根工作区 association 粒度）与 1 个中风险（增强预览生态在只读 viewer 中不可用）。
  - 已完成编译验证：`npm run compile` 通过。
  - 后续仍需按阈值推进可选渲染验证（`switch p95 <= 71ms 且 <= 110.6ms`、`first <= 290ms 且 < 568ms`）。

### D5

- 结果：待开始
- 备注：将基于 D4 对照数据与阈值判定给出“渲染模式去留”结论（继续推进 / 默认关闭保留实验态 / 暂缓）。

## 风险与阻塞

- 高风险：多根工作区下，实验开关同步 `workbench.editorAssociations` 时未覆盖 workspaceFolder 级粒度，可能影响用户已有细粒度关联配置（详见 D4 报告）。
- 中风险：实验态只读 viewer 不走内置 Markdown Preview 增强管线，部分增强预览扩展能力不可直接复用（详见 D4 报告）。
