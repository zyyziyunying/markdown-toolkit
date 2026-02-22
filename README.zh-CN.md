# Markdown Toolkit（简体中文）

一个用于 VS Code 的扩展，可将 Markdown 预览在当前标签页原位打开。

English README: [`README.md`](README.md)

## 功能说明

VS Code 默认的 Markdown 预览通常会保留源码编辑器标签页。  
本扩展提供“原位预览”命令，会在同一分栏中用预览编辑器替换当前 Markdown 标签页。

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

## 项目结构

- `src/extension.ts`：原位预览与退出命令实现
- `package.json`：VS Code 贡献点与构建配置
- `tsconfig.json`：TypeScript 编译配置

## 开发

```bash
npm install
npm run compile
```

在 VS Code 中按 `F5` 启动 Extension Development Host。
