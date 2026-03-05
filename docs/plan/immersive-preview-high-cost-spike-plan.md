# 沉浸式预览高成本路线 1 周 Spike 计划

日期：2026-03-05  
来源：`../discussions/immersive-preview-flicker-feasibility.md`

## D1 机制打样

- [x] 新增 feature flag（默认关闭）
- [x] 最小 custom readonly viewer 打桩可打开 `.md`
- [x] 提供“回到源码编辑”命令入口

## D2 入口与交互闭环

- [x] 覆盖 Explorer / Quick Open / 最近文件 / 命令面板打开文件（代码路径已补齐）
- [x] 增加 viewer 内“切回编辑”可见入口
- [x] 验证回到源码编辑 <= 1 次操作

## D3 闪烁与性能采样

- [x] 固定脚本：10 个 Markdown 文件连续切换 3 轮（命令：`markdownToolkit.runImmersiveReadonlyViewerSpikeBenchmark`）
- [x] 记录首次打开与连续切换 p50/p95（Readonly：first 132ms，switch p50 29ms，switch p95 39.6ms）
- [x] 与当前 `openWith` 方案做基线对比（Baseline：first 568ms，switch p50 99ms，switch p95 138.2ms）

## D4 兼容性抽测

- [ ] 抽测常见 Markdown 扩展共存
- [ ] 抽测分屏/多窗口、Remote/WSL、多根工作区
- [ ] 输出阻塞/高/中/低问题清单

## D5 决策与收口

- [ ] 汇总收益、成本、风险、剩余工作量
- [ ] 给出 Go/No-Go 结论
- [ ] 明确灰度发布与回滚方案
