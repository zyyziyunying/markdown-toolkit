# D4 兼容性抽测报告（高成本路线 Spike）

日期：2026-03-05  
对应计划：`../plan/immersive-preview-high-cost-spike-plan.md`  
来源讨论：`../discussions/immersive-preview-flicker-feasibility.md`

## 抽测范围

- 常见 Markdown 扩展共存（目录/导航、Lint、增强预览类）。
- 分屏/多窗口、Remote/WSL、多根工作区。
- 输出阻塞/高/中/低问题清单（本轮不含可选渲染 benchmark）。

## 抽测方法

- 代码级抽测：基于 `package.json` 的命令/菜单条件与 `src/extension.ts` 的 editor association、custom editor、读取链路进行静态验证。
- 构建验证：`npm run compile`（通过）。
- 说明：当前 CLI 环境无法直接启动 Extension Development Host 或安装第三方扩展做 UI 交互复测；本报告为 D4 的“兼容性抽测（静态+机制级）”结论。

## 手测补充（2026-03-05）

- 用户手测确认：从实验态只读 viewer 可 **1 步切回源码编辑**（通过）。
- 用户手测确认：分屏“拆分右移”路径无异常（通过）。
- 按当前推进口径，D4 的对应兼容性项可视为通过；Remote/WSL 与多根工作区仍保留风险跟踪项。

## 抽测结论

### 1) 常见 Markdown 扩展共存

- 目录/导航类（如 TOC 命令类）：**有条件通过**。只读 viewer 激活时属于 custom editor，编辑器型命令不会直接生效；可通过“切回源码编辑”一键回到普通 Markdown 编辑器继续使用。
- Lint 类（如 markdownlint）：**有条件通过**。不会与本扩展命令注册冲突；但在只读 viewer 激活态下，不提供文本编辑交互。
- 增强预览类（依赖 `markdown.previewScripts` / `markdown.previewStyles`）：**风险保留**。这类增强对内置 Markdown Preview 生效；对实验态只读 viewer 不直接生效。

### 2) 分屏/多窗口、Remote/WSL、多根工作区

- 分屏/同文档多标签：**通过**。custom editor provider 已启用 `supportsMultipleEditorsPerDocument: true`。
- 多窗口：**通过（机制级）**。实验态依赖 `workbench.editorAssociations` 统一路由，不依赖单窗口内存状态。
- Remote/WSL：**通过（机制级）**。只读 viewer 内容读取走 `vscode.workspace.fs.readFile(uri)`，不绑定本地文件 API。
- 多根工作区：**高风险**。当前 association 写入目标仅按“有无 workspace folder”二选一（Workspace/Global），未覆盖 workspaceFolder 级差异化策略，可能影响用户已有的细粒度关联配置。

## 问题清单（阻塞/高/中/低）

### 阻塞（Blocking）

- 无。

### 高（High）

1. 多根工作区下 editor association 粒度风险  
   - 现象：实验开关同步 association 时，目标只在 Workspace/Global 二选一。  
   - 影响：可能覆盖用户 workspaceFolder 级 `*.md` 关联，导致“只想在部分根目录启用”的预期落空。  
   - 证据：`src/extension.ts:356`、`src/extension.ts:407`。  
   - 建议：D5 前评估是否引入 workspaceFolder 级策略或明确文档限制。

### 中（Medium）

1. 增强预览生态在只读 viewer 中不可用  
   - 现象：实验态 viewer 当前不是内置 Markdown Preview 管线。  
   - 影响：依赖 `markdown.previewScripts` / `markdown.previewStyles` 的增强扩展无法直接复用到只读 viewer。  
   - 证据：`package.json:219`、`src/extension.ts:149`。  
   - 建议：与“可选渲染验证”一起评估是否需要兼容层，或在文档中明确能力边界。

### 低（Low）

1. 只读 viewer 模式心智提示可继续加强  
   - 现象：当前仅通过标题文案和“切回源码编辑”按钮引导。  
   - 影响：部分用户可能误以为功能受限来自扩展冲突，而非只读模式设计。  
   - 证据：`src/extension.ts:212`、`src/extension.ts:213`。  
   - 建议：后续可补充更明确的状态提示（如“当前为实验态只读模式”）。

## D4 判定

- 兼容性抽测阶段结论：**完成**（无阻塞项，存在 1 个高风险与 1 个中风险，均有回退路径）。
- 可选渲染验证（D4 可选项）：**未开始**，待功能推进后按阈值补跑 benchmark。
