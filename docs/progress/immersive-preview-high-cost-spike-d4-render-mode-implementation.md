# D4 可选渲染模式推进记录（高成本路线 Spike）

日期：2026-03-05  
对应计划：`../plan/immersive-preview-high-cost-spike-plan.md`  
关联讨论：`../discussions/immersive-preview-flicker-feasibility.md`

## 当前状态

- 状态：代码实现完成，待 Extension Development Host 手测与 benchmark 补跑。
- 范围：对应计划 D4 可选项（渲染模式接入、benchmark 对照、阈值判定输出）。

## 已完成实现

1. 只读 viewer 增加渲染模式开关（默认关闭）  
   - 新增配置：`markdownToolkit.experimental.immersiveReadonlyViewerRenderMode`。
2. 只读 viewer 支持 Markdown 渲染内容展示  
   - 优先调用内置 `markdown.api.render`；不可用时回退轻量解析。  
   - 渲染模式下接入 Mermaid 资源（`mermaid.min.js` + 交互脚本 + 样式）。
3. benchmark 命令扩展  
   - `markdownToolkit.runImmersiveReadonlyViewerSpikeBenchmark` 在渲染模式开启时会补跑三组：  
     - Readonly Viewer（plain text）  
     - Readonly Viewer（render mode）  
     - Baseline（source + openWith preview）  
   - 输出 render vs plain/baseline 的 delta。
4. 阈值判定输出  
   - 命令输出 PASS/FAIL：  
     - `switch p95 <= 71ms 且 <= 110.6ms`  
     - `first <= 290ms 且 < 568ms`

## 本地验证

- `npm run compile`：通过。

## 待补充验证（手测）

1. 渲染正确性抽测（标题、列表、代码块、表格、引用、链接、图片、Mermaid）。
2. 复用固定脚本补跑 benchmark 并记录结果文件。
3. 基于实测值回填计划 D4 第 28-30 项勾选状态。

## 后续执行备注

- 本文档当前为“代码已就绪，待手测/补跑”的中间态记录。
- 后续执行完成后，建议新增“实测结果”小节，直接粘贴 benchmark summary 与阈值判定结论（PASS/FAIL）。
