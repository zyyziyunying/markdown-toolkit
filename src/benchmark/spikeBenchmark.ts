import * as vscode from "vscode";
import {
  MARKDOWN_READONLY_VIEWER_EDITOR,
  RENDER_MODE_FIRST_OPEN_BASELINE_THRESHOLD_MS,
  RENDER_MODE_FIRST_OPEN_THRESHOLD_MS,
  RENDER_MODE_SWITCH_P95_BASELINE_THRESHOLD_MS,
  RENDER_MODE_SWITCH_P95_THRESHOLD_MS,
  SPIKE_BENCHMARK_FILE_COUNT,
  SPIKE_BENCHMARK_ROUNDS,
  SPIKE_BENCHMARK_SWITCH_DELAY_MS,
} from "../shared/constants";
import {
  SpikeBenchmarkMode,
  SpikeBenchmarkResult,
  SpikeBenchmarkSample,
} from "../shared/types";
import { RuntimeState } from "../state/runtimeState";
import { openMarkdownPreview, openMarkdownSourceEditor } from "../preview/previewCommands";

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculatePercentile(values: readonly number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const percentileIndex = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(percentileIndex);
  const upperIndex = Math.ceil(percentileIndex);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const upperWeight = percentileIndex - lowerIndex;
  const lowerWeight = 1 - upperWeight;
  return (
    sortedValues[lowerIndex] * lowerWeight +
    sortedValues[upperIndex] * upperWeight
  );
}

function getSpikeBenchmarkModeLabel(mode: SpikeBenchmarkMode): string {
  switch (mode) {
    case "readonlyViewerPlainText":
      return "Readonly Viewer (plain text)";
    case "readonlyViewerRendered":
      return "Readonly Viewer (render mode)";
    case "baselineOpenWith":
    default:
      return "Baseline (source + openWith preview)";
  }
}

function getSpikeBenchmarkSummaryLine(result: SpikeBenchmarkResult): string {
  const switchSampleCount = Math.max(result.samples.length - 1, 0);
  return `${getSpikeBenchmarkModeLabel(result.mode)} | first=${roundToTwoDecimals(
    result.firstOpenMs,
  )}ms | switch p50=${roundToTwoDecimals(
    result.switchP50Ms,
  )}ms | switch p95=${roundToTwoDecimals(
    result.switchP95Ms,
  )}ms | samples=${result.samples.length} (${switchSampleCount} switch samples)`;
}

function getDeltaPercent(current: number, baseline: number): number {
  if (baseline === 0) {
    return 0;
  }

  return ((current - baseline) / baseline) * 100;
}

function getThresholdStatus(passed: boolean): string {
  return passed ? "PASS" : "FAIL";
}

function getRenderModeThresholdEvaluationLines(
  renderModeResult: SpikeBenchmarkResult,
): string[] {
  const switchP95ThresholdPassed =
    renderModeResult.switchP95Ms <= RENDER_MODE_SWITCH_P95_THRESHOLD_MS &&
    renderModeResult.switchP95Ms <= RENDER_MODE_SWITCH_P95_BASELINE_THRESHOLD_MS;
  const firstOpenThresholdPassed =
    renderModeResult.firstOpenMs <= RENDER_MODE_FIRST_OPEN_THRESHOLD_MS &&
    renderModeResult.firstOpenMs < RENDER_MODE_FIRST_OPEN_BASELINE_THRESHOLD_MS;
  const allThresholdPassed = switchP95ThresholdPassed && firstOpenThresholdPassed;

  return [
    `Render mode threshold check | overall=${getThresholdStatus(allThresholdPassed)}`,
    `- switch p95=${roundToTwoDecimals(renderModeResult.switchP95Ms)}ms | threshold=${RENDER_MODE_SWITCH_P95_THRESHOLD_MS}ms and ${RENDER_MODE_SWITCH_P95_BASELINE_THRESHOLD_MS}ms | ${getThresholdStatus(switchP95ThresholdPassed)}`,
    `- first=${roundToTwoDecimals(renderModeResult.firstOpenMs)}ms | threshold=${RENDER_MODE_FIRST_OPEN_THRESHOLD_MS}ms and <${RENDER_MODE_FIRST_OPEN_BASELINE_THRESHOLD_MS}ms | ${getThresholdStatus(firstOpenThresholdPassed)}`,
  ];
}

async function collectMarkdownUrisForSpikeBenchmark(): Promise<vscode.Uri[] | undefined> {
  const markdownUris = await vscode.workspace.findFiles(
    "**/*.md",
    "**/{node_modules,.git,out}/**",
    SPIKE_BENCHMARK_FILE_COUNT,
  );
  if (markdownUris.length < SPIKE_BENCHMARK_FILE_COUNT) {
    await vscode.window.showWarningMessage(
      `需要至少 ${SPIKE_BENCHMARK_FILE_COUNT} 个 Markdown 文件，当前仅找到 ${markdownUris.length} 个。`,
    );
    return undefined;
  }

  return markdownUris
    .slice()
    .sort((left, right) => left.fsPath.localeCompare(right.fsPath))
    .slice(0, SPIKE_BENCHMARK_FILE_COUNT);
}

async function runSpikeBenchmarkMode(
  state: RuntimeState,
  mode: SpikeBenchmarkMode,
  markdownUris: readonly vscode.Uri[],
  outputChannel: vscode.OutputChannel,
): Promise<SpikeBenchmarkResult> {
  const viewColumn = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
  const samples: SpikeBenchmarkSample[] = [];
  const previousRenderModeOverride = state.readonlyViewerRenderModeOverride;

  if (mode === "readonlyViewerPlainText") {
    state.readonlyViewerRenderModeOverride = "plainText";
  } else if (mode === "readonlyViewerRendered") {
    state.readonlyViewerRenderModeOverride = "rendered";
  } else {
    state.readonlyViewerRenderModeOverride = undefined;
  }

  outputChannel.appendLine(`开始模式：${getSpikeBenchmarkModeLabel(mode)}`);

  try {
    for (let round = 1; round <= SPIKE_BENCHMARK_ROUNDS; round += 1) {
      for (let fileIndex = 0; fileIndex < markdownUris.length; fileIndex += 1) {
        const uri = markdownUris[fileIndex];
        const startedAt = Date.now();

        if (mode === "baselineOpenWith") {
          await openMarkdownSourceEditor(uri, viewColumn);
          await openMarkdownPreview(uri, viewColumn);
        } else {
          await vscode.commands.executeCommand(
            "vscode.openWith",
            uri,
            MARKDOWN_READONLY_VIEWER_EDITOR,
            {
              viewColumn,
              preview: true,
              preserveFocus: false,
            },
          );
        }

        const durationMs = Date.now() - startedAt;
        samples.push({
          mode,
          round,
          fileIndex: fileIndex + 1,
          uri,
          durationMs,
        });
        outputChannel.appendLine(
          `[${getSpikeBenchmarkModeLabel(mode)}] round=${round} file=${fileIndex + 1} duration=${durationMs}ms uri=${uri.toString()}`,
        );
        await delay(SPIKE_BENCHMARK_SWITCH_DELAY_MS);
      }
    }
  } finally {
    state.readonlyViewerRenderModeOverride = previousRenderModeOverride;
  }

  const firstOpenMs = samples[0]?.durationMs ?? 0;
  const switchDurations = samples.slice(1).map((sample) => sample.durationMs);

  return {
    mode,
    firstOpenMs,
    switchP50Ms: calculatePercentile(switchDurations, 0.5),
    switchP95Ms: calculatePercentile(switchDurations, 0.95),
    samples,
  };
}

export async function runImmersiveReadonlyViewerSpikeBenchmark(
  state: RuntimeState,
): Promise<void> {
  if (!state.readonlyViewerExperimentEnabled) {
    await vscode.window.showInformationMessage(
      "请先启用 markdownToolkit.experimental.immersiveReadonlyViewer 再执行 Spike benchmark。",
    );
    return;
  }

  const markdownUris = await collectMarkdownUrisForSpikeBenchmark();
  if (!markdownUris) {
    return;
  }

  const outputChannel = vscode.window.createOutputChannel(
    "Markdown Toolkit Spike Benchmark",
  );
  outputChannel.clear();
  outputChannel.show(true);
  outputChannel.appendLine(
    `Spike benchmark started at ${new Date().toISOString()} (${SPIKE_BENCHMARK_FILE_COUNT} files x ${SPIKE_BENCHMARK_ROUNDS} rounds)`,
  );
  outputChannel.appendLine("Files:");
  for (const uri of markdownUris) {
    outputChannel.appendLine(`- ${uri.toString()}`);
  }
  outputChannel.appendLine("");

  try {
    const readonlyViewerPlainResult = await runSpikeBenchmarkMode(
      state,
      "readonlyViewerPlainText",
      markdownUris,
      outputChannel,
    );
    outputChannel.appendLine("");
    let readonlyViewerRenderResult: SpikeBenchmarkResult | undefined;
    if (state.readonlyViewerRenderModeEnabled) {
      readonlyViewerRenderResult = await runSpikeBenchmarkMode(
        state,
        "readonlyViewerRendered",
        markdownUris,
        outputChannel,
      );
      outputChannel.appendLine("");
    } else {
      outputChannel.appendLine(
        "渲染模式 benchmark 已跳过：请启用 markdownToolkit.experimental.immersiveReadonlyViewerRenderMode 后补跑。",
      );
      outputChannel.appendLine("");
    }

    const baselineResult = await runSpikeBenchmarkMode(
      state,
      "baselineOpenWith",
      markdownUris,
      outputChannel,
    );

    const plainFirstOpenDelta = getDeltaPercent(
      readonlyViewerPlainResult.firstOpenMs,
      baselineResult.firstOpenMs,
    );
    const plainSwitchP95Delta = getDeltaPercent(
      readonlyViewerPlainResult.switchP95Ms,
      baselineResult.switchP95Ms,
    );

    outputChannel.appendLine("");
    outputChannel.appendLine("Summary:");
    outputChannel.appendLine(getSpikeBenchmarkSummaryLine(readonlyViewerPlainResult));
    if (readonlyViewerRenderResult) {
      outputChannel.appendLine(getSpikeBenchmarkSummaryLine(readonlyViewerRenderResult));
    }
    outputChannel.appendLine(getSpikeBenchmarkSummaryLine(baselineResult));
    outputChannel.appendLine(
      `Plain readonly vs Baseline delta | first=${roundToTwoDecimals(plainFirstOpenDelta)}% | switch p95=${roundToTwoDecimals(plainSwitchP95Delta)}%`,
    );
    if (readonlyViewerRenderResult) {
      const renderFirstOpenDeltaVsBaseline = getDeltaPercent(
        readonlyViewerRenderResult.firstOpenMs,
        baselineResult.firstOpenMs,
      );
      const renderSwitchP95DeltaVsBaseline = getDeltaPercent(
        readonlyViewerRenderResult.switchP95Ms,
        baselineResult.switchP95Ms,
      );
      const renderFirstOpenDeltaVsPlain = getDeltaPercent(
        readonlyViewerRenderResult.firstOpenMs,
        readonlyViewerPlainResult.firstOpenMs,
      );
      const renderSwitchP95DeltaVsPlain = getDeltaPercent(
        readonlyViewerRenderResult.switchP95Ms,
        readonlyViewerPlainResult.switchP95Ms,
      );
      outputChannel.appendLine(
        `Render readonly vs Baseline delta | first=${roundToTwoDecimals(renderFirstOpenDeltaVsBaseline)}% | switch p95=${roundToTwoDecimals(renderSwitchP95DeltaVsBaseline)}%`,
      );
      outputChannel.appendLine(
        `Render readonly vs Plain readonly delta | first=${roundToTwoDecimals(renderFirstOpenDeltaVsPlain)}% | switch p95=${roundToTwoDecimals(renderSwitchP95DeltaVsPlain)}%`,
      );
      outputChannel.appendLine("");
      for (const line of getRenderModeThresholdEvaluationLines(readonlyViewerRenderResult)) {
        outputChannel.appendLine(line);
      }
    }

    await vscode.window.showInformationMessage(
      "Spike benchmark 已完成，详情请查看 Output: Markdown Toolkit Spike Benchmark。",
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`执行 Spike benchmark 失败: ${reason}`);
  }
}
