# Markdown Toolkit

A VS Code extension that opens Markdown preview in-place.

简体中文文档：[`README.zh-CN.md`](README.zh-CN.md)

## What it does

VS Code's default Markdown preview action usually keeps the source editor tab open.
This extension provides an "in-place" preview command that replaces the current
Markdown editor tab with a preview editor in the same view column.

It also adds Mermaid rendering in Markdown preview with built-in interaction tools.

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

## Mermaid support

- Fenced code blocks with language `mermaid` are rendered as diagrams in Markdown preview.
- Long Mermaid labels are safer by default:
  - Increased Mermaid `maxTextSize` to reduce render failures on large diagrams.
  - Enable label wrapping with node box height sync to prevent wrapped text overflow.
  - Wrap Mermaid source fallback blocks on render error for better readability.
- Mermaid theme now follows VS Code color mode (light/dark) for better contrast.
- Interactive controls are added on each Mermaid diagram:
  - `+` / `-` buttons to zoom.
  - `Reset` button to restore default zoom and position.
  - `Focus` button and double-click in the diagram to enter immersive focus mode.
  - In focus mode, press `Esc` or double-click again to exit.
  - Drag to pan the diagram.
  - `Ctrl`/`Cmd` + mouse wheel to zoom around the cursor position.

## Project structure

- `src/extension.ts`: preview-in-place command implementation
- `media/mermaid.min.js`: bundled Mermaid runtime for preview
- `media/mermaidPreview.js`: Mermaid rendering + zoom/pan behavior in preview
- `media/mermaidPreview.css`: Mermaid preview UI styles
- `.vscode/launch.json`: extension debug launch presets
- `.vscode/tasks.json`: compile/watch tasks used by debug presets
- `package.json`: VS Code contribution and build configuration
- `tsconfig.json`: TypeScript compiler options

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host.

Preconfigured launch options:

- `Run Extension`: compile once, then launch.
- `Watch + Run Extension`: start `tsc --watch`, then launch.

Both debug profiles use `--disable-extensions` to reduce noise from unrelated extension logs.
