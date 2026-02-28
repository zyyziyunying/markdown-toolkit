# Changelog

## Unreleased

## 1.0.3 - 2026-02-28

- Improve floating-preview reuse logic: when an existing Markdown preview group is already detached, new floating previews are moved into that group instead of always spawning another VS Code window.

## 1.0.2 - 2026-02-28

- Fix floating preview workflow to replace the source Markdown tab before detaching, reducing preview scroll snap-back caused by dual source+preview sync.
- Gate `Open Markdown Preview (In Place)` by active editor context so it hides/disables when already in preview or outside Markdown source mode.

## 1.0.1 - 2026-02-27

- Add `Open Floating Markdown Preview` command to detach preview into a new VS Code window.
- Add floating-preview shortcut: `Ctrl+Alt+Shift+M` (`Cmd+Alt+Shift+M` on macOS).
- Add floating command icon and compact title for cleaner editor title actions.
- Hide floating/exit actions in auxiliary windows to avoid redundant nested actions.

## 1.0.0 - 2026-02-27

- Improve Mermaid long-text stability by increasing `maxTextSize`.
- Fix Mermaid long-label wrapping layout so node box height grows with wrapped text.
- Wrap Mermaid source fallback blocks on render error for better readability.
- Auto-select Mermaid light/dark theme based on VS Code color mode.
- Add VS Code debug launch/task presets (`Run Extension` / `Watch + Run Extension`).

## 0.0.5

- Add immersive Mermaid focus mode (double-click or toolbar button) to maximize diagram viewing area.
- Add focus mode exit shortcuts: `Esc` or double-click the diagram again.
- Auto-fit diagram to viewport when entering focus mode.

## 0.0.4

- Add Mermaid rendering support for fenced `mermaid` code blocks in Markdown preview.
- Add diagram interaction tools: zoom buttons, reset, drag-to-pan, and Ctrl/Cmd + wheel zoom.
- Add bundled Mermaid runtime plus dedicated preview script/style assets.

## 0.0.3

- Add explicit exit command for Markdown preview in place.
- Add exit entry in preview context menu and title area.
- Disable double-click to switch back to editor by default.

## 0.0.2

- Add "Open Markdown Preview (In Place)" command.
- Add Markdown-only editor title/context menu entries and shortcut.

## 0.0.1

- Initialize extension scaffold.
