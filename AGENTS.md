# Repository Guidelines

## Project Structure & Module Organization
- `src/extension.ts`: extension entrypoint and command/session logic (in-place preview, floating preview, exit flow).
- `media/`: Markdown preview runtime assets (`mermaid*.js`, `mermaidPreview.css`); these power Mermaid rendering and interaction in webview preview.
- `out/`: compiled output from TypeScript (`tsc`). Treat as build artifacts; do not hand-edit.
- `docs/`: project documentation workspace. Use this structure consistently:
  - `docs/discussions/`: feasibility notes, trade-offs, and technical decisions.
  - `docs/plan/`: execution plans and checklist-style task breakdowns.
  - `docs/progress/`: day-by-day status updates, risks, and blockers.
  - Keep each area indexable with `README.md`, and link related files across `discussions -> plan -> progress`.
- `.vscode/launch.json` and `.vscode/tasks.json`: local debug/task presets for Extension Development Host.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run compile`: one-time TypeScript build to `out/`.
- `npm run watch`: incremental TypeScript rebuild while developing.
- `npm run vscode:prepublish`: pre-publish compile step used before packaging.
- In VS Code, press `F5` (`Run Extension` / `Watch + Run Extension`) to launch an Extension Development Host.

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode enabled in `tsconfig.json`).
- Follow existing style: 2-space indentation, semicolons, double quotes, trailing commas where helpful.
- Naming: `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants, command IDs as `markdownToolkit.*`.
- Keep functions small and behavior-focused; only add comments when intent is not obvious from code.

## Testing Guidelines
- There is currently no dedicated automated test suite.
- Minimum validation for every change:
  - `npm run compile` passes with no TypeScript errors.
  - Manual smoke test in Extension Development Host for Markdown open/switch/exit workflows.
  - If touching Mermaid logic, verify zoom/pan/focus/reset interactions still work.
- Document manual verification steps in PR descriptions.

## Commit & Pull Request Guidelines
- Prefer Conventional Commit prefixes used in history: `feat:`, `fix:`, `refactor:`, `chore:`, `chore(release):`.
- Keep commit scope focused; separate release/version-bump changes from feature fixes.
- PRs should include: purpose, key changes, linked issue (if any), and screenshots/GIFs for UI behavior changes.
- Add a short “how tested” checklist (commands + manual scenarios).
