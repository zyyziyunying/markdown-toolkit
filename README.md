# Markdown Toolkit

A VS Code extension that opens Markdown preview in-place.

简体中文文档：[`README.zh-CN.md`](README.zh-CN.md)

## What it does

VS Code's default Markdown preview action usually keeps the source editor tab open.
This extension provides an "in-place" preview command that replaces the current
Markdown editor tab with a preview editor in the same view column.

## Command

- `Markdown Toolkit: Open Markdown Preview (In Place)` (`markdownToolkit.openPreviewInPlace`)
- `Markdown Toolkit: Exit Markdown Preview (In Place)` (`markdownToolkit.exitPreviewInPlace`)

## Trigger points

- Editor title button (when the active file is Markdown)
- Editor title button in preview mode (exit)
- Editor context menu
- Preview right-click menu (exit)
- Keyboard shortcut: `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS)

## Behavior tweak

The extension sets `markdown.preview.doubleClickToSwitchToEditor` to `false` by default,
so double-click in preview no longer exits reading mode.

## Project structure

- `src/extension.ts`: preview-in-place command implementation
- `package.json`: VS Code contribution and build configuration
- `tsconfig.json`: TypeScript compiler options

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host.
