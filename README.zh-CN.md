# Markdown Toolkit（简体中文）

一个用于 VS Code 的扩展，可将 Markdown 预览在当前标签页原位打开。

English README: [`README.md`](README.md)

## 功能说明

VS Code 默认的 Markdown 预览通常会保留源码编辑器标签页。  
本扩展提供“原位预览”命令，会在同一分栏中用预览编辑器替换当前 Markdown 标签页。

同时，它还为 Markdown 预览增加了 Mermaid 渲染和图表交互能力。

## 命令

- `Markdown Toolkit: Open Markdown Preview (In Place)`（`markdownToolkit.openPreviewInPlace`）
- `Markdown Toolkit: Exit Markdown Preview (In Place)`（`markdownToolkit.exitPreviewInPlace`）

## 触发入口

- 编辑器标题栏按钮（Markdown 文件打开时）
- 预览模式下的标题栏按钮（退出）
- 编辑器右键菜单
- 预览区右键菜单（退出）
- 快捷键：`Ctrl+Alt+M`（macOS 为 `Cmd+Alt+M`）

## 行为调整

扩展默认将 `markdown.preview.doubleClickToSwitchToEditor` 设为 `false`，  
即在预览中双击不再自动退出阅读模式。

## Mermaid 支持

- 语言标识为 `mermaid` 的围栏代码块会在 Markdown 预览中直接渲染为图表。
- 针对长文本做了默认兜底：
  - 提高 Mermaid `maxTextSize`，降低大图/长文本渲染失败概率。
  - 节点标签支持自动换行，且节点方块高度会同步增长，避免文字溢出。
  - 渲染失败时源码回退区域也会自动换行，便于阅读排错。
- 每个 Mermaid 图表都带有交互工具：
  - `+` / `-` 按钮可缩放。
  - `Reset` 按钮可恢复默认缩放和位置。
  - `Focus` 按钮或在图表区域双击可进入沉浸式专注查看模式。
  - 专注模式下按 `Esc` 或再次双击可退出。
  - 鼠标左键拖拽可平移画布。
  - `Ctrl`/`Cmd` + 鼠标滚轮可按光标位置缩放。

## 项目结构

- `src/extension.ts`：原位预览与退出命令实现
- `media/mermaid.min.js`：内置 Mermaid 运行时脚本
- `media/mermaidPreview.js`：Mermaid 渲染与缩放/平移交互
- `media/mermaidPreview.css`：Mermaid 预览样式
- `.vscode/launch.json`：扩展调试启动配置
- `.vscode/tasks.json`：调试使用的编译/监听任务
- `package.json`：VS Code 贡献点与构建配置
- `tsconfig.json`：TypeScript 编译配置

## 开发

```bash
npm install
npm run compile
```

在 VS Code 中按 `F5` 启动 Extension Development Host。

已预置两套调试配置：

- `Run Extension`：先编译一次再启动。
- `Watch + Run Extension`：先启动 `tsc --watch` 再启动。

两套调试配置都启用了 `--disable-extensions`，用于减少其他扩展日志干扰。
