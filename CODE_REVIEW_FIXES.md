# Markdown Toolkit 修复清单（按优先级）

> 目标：把“能用”提升到“稳、准、不坑人”。

## P0（立刻修）

- [x] **修正退出命令的错误暴露**
  - 问题：`webview/context` 里对普通 `markdown.preview` 也显示“Exit”，但代码只支持 `vscode.markdown.preview.editor`，用户会点了没用。
  - 涉及：`package.json:71`、`src/extension.ts:52`、`src/extension.ts:56`。
  - 修法（二选一）：
    1. **保守方案（推荐，已实施）**：菜单条件仅保留 `activeCustomEditorId == vscode.markdown.preview.editor`。
    2. **增强方案**：补齐普通 preview 的退出路径（并确保行为一致）。
  - 验收：普通 Markdown 预览不再出现“假按钮”；in-place 预览下可正常退出。

## P1（本周修）

- [ ] **修正 Mermaid 拖拽与点击冲突（延迟验收）**
  - 问题：`pointerdown` 立即 `preventDefault + setPointerCapture`，会抢走点击语义，影响 `bindFunctions` 的交互。
  - 涉及：`media/mermaidPreview.js:356`、`media/mermaidPreview.js:390`、`media/mermaidPreview.js:425`。
  - 修法：
    - 引入拖拽阈值（如 3~5px）后再进入 dragging。
    - 仅在“确认拖拽后”再 `preventDefault`/capture。
    - 对链接、可点击节点放行点击（不启动拖拽）。
  - 当前进展：拖拽手感已验证通过。
  - 延迟验收：节点点击暂无合适文档，待补测试文档后复测。
  - 验收：节点点击/链接点击可用；拖拽依然顺滑。

- [ ] **撤销全局默认行为污染（延迟验收）**
  - 问题：扩展强行设置 `markdown.preview.doubleClickToSwitchToEditor=false`，影响所有 Markdown 预览。
  - 涉及：`package.json`、`media/mermaidPreview.js`。
  - 修法：
    - 移除 `configurationDefaults` 的该项；只在 README 说明“可选建议配置”。
    - 如需保留，至少新增扩展开关并默认不改全局行为。
  - 当前进展：
    - 已移除 `configurationDefaults` 的 `markdown.preview.doubleClickToSwitchToEditor`。
    - 已改为在预览脚本中运行时拦截双击，避免写入全局/工作区设置。
  - 延迟验收：当前安装包实测“预览双击不退出”未稳定复现，后续再排查 VS Code 预览事件链。
  - 验收：安装扩展后，用户原生 Markdown 预览默认行为不被悄悄改写。

- [ ] **补最小测试护栏**
  - 问题：无 `test` 脚本，回归风险高。
  - 涉及：`package.json:95`。
  - 修法：
    - 增加 `npm test`，接入最小扩展测试（命令触发、菜单可见性/可执行性）。
    - 至少覆盖：open/exit 命令基本路径 + Mermaid 渲染失败 fallback。
  - 验收：CI/本地可跑 `npm test`，关键路径有自动回归检测。

## P2（下个迭代）

- [ ] **统一文案与国际化策略**
  - 问题：命令英文、提示中文，体验割裂。
  - 涉及：`package.json:31`、`package.json:37`、`src/extension.ts:24`、`src/extension.ts:41`、`src/extension.ts:69`、`src/extension.ts:86`。
  - 修法：
    - 统一为单语言，或接入 `vscode.l10n.t` + `package.nls*.json`。
  - 验收：同一语言环境下，UI 文案一致。

- [ ] **建立 Mermaid 依赖更新机制**
  - 问题：`media/mermaid.min.js` 手工 vendoring，无更新/校验流程。
  - 涉及：`package.json:84`、`media/mermaid.min.js`。
  - 修法：
    - 增加脚本：固定版本拉取、记录来源版本、校验文件完整性。
    - 在 `CHANGELOG.md` 标注 Mermaid 升级记录。
  - 验收：升级 Mermaid 时有标准流程，不靠手工“玄学替换”。

## 建议实施顺序（最快止血）

1. P0：修菜单误导（先止坑）。
2. P1：修交互冲突（避免“看起来能点，实际点不动”）。
3. P1：移除全局配置污染。
4. P1：补最小自动化测试。
5. P2：再做 i18n 和依赖升级流程。

## 建议提交拆分

- Commit 1：菜单条件与退出命令行为一致性。
- Commit 2：Mermaid 拖拽/点击事件重构。
- Commit 3：移除全局默认配置 + README 调整。
- Commit 4：测试框架与最小用例。
- Commit 5：i18n 与 Mermaid 更新脚本。
