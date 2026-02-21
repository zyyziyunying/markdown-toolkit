# Markdown Toolkit

A VS Code extension that opens Markdown preview in-place.

## What it does

VS Code's default Markdown preview action usually keeps the source editor tab open.
This extension provides an "in-place" preview command that replaces the current
Markdown editor tab with a preview editor in the same view column.

## Command

- `Markdown Toolkit: Open Markdown Preview (In Place)` (`markdownToolkit.openPreviewInPlace`)

## Trigger points

- Editor title button (when the active file is Markdown)
- Editor context menu
- Keyboard shortcut: `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS)

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
