import * as vscode from "vscode";

const OPEN_PREVIEW_IN_PLACE_COMMAND = "markdownToolkit.openPreviewInPlace";
const OPEN_FLOATING_PREVIEW_COMMAND = "markdownToolkit.openFloatingPreview";
const EXIT_PREVIEW_IN_PLACE_COMMAND = "markdownToolkit.exitPreviewInPlace";
const OPEN_READONLY_VIEWER_COMMAND = "markdownToolkit.openReadonlyViewer";
const SWITCH_TO_SOURCE_EDITOR_COMMAND = "markdownToolkit.switchToSourceEditor";
const RUN_SPIKE_BENCHMARK_COMMAND =
  "markdownToolkit.runImmersiveReadonlyViewerSpikeBenchmark";
const MARKDOWN_PREVIEW_EDITOR = "vscode.markdown.preview.editor";
const MARKDOWN_READONLY_VIEWER_EDITOR = "markdownToolkit.markdownReadonlyViewer";
const IMMERSIVE_PREVIEW_CONTEXT_KEY = "markdownToolkit.immersiveEnabled";
const READONLY_VIEWER_EXPERIMENT_CONTEXT_KEY =
  "markdownToolkit.experimentalReadonlyViewerEnabled";
const READONLY_VIEWER_EXPERIMENT_CONFIGURATION_SECTION = "markdownToolkit";
const READONLY_VIEWER_EXPERIMENT_CONFIGURATION_KEY =
  "experimental.immersiveReadonlyViewer";
const READONLY_VIEWER_EXPERIMENT_FULL_CONFIGURATION_KEY =
  "markdownToolkit.experimental.immersiveReadonlyViewer";
const PREVIOUS_MARKDOWN_ASSOCIATION_STORAGE_KEY =
  "markdownToolkit.readonlyViewer.previousMarkdownAssociation";
const WORKBENCH_CONFIGURATION_SECTION = "workbench";
const EDITOR_ASSOCIATIONS_CONFIGURATION_KEY = "editorAssociations";
const MARKDOWN_FILE_ASSOCIATION_PATTERN = "*.md";
const READONLY_VIEWER_SWITCH_TO_SOURCE_MESSAGE_TYPE = "switchToSourceEditor";
const MOVE_ACTIVE_EDITOR_COMMAND = "moveActiveEditor";
const MOVE_EDITOR_ARGUMENT_BY_GROUP = "group";
const MOVE_EDITOR_ARGUMENT_TO_POSITION = "position";
const MAX_DETACHED_PREVIEW_MEMORY = 32;
const SPIKE_BENCHMARK_FILE_COUNT = 10;
const SPIKE_BENCHMARK_ROUNDS = 3;
const SPIKE_BENCHMARK_SWITCH_DELAY_MS = 80;

interface ActiveMarkdownPreview {
  readonly uri: vscode.Uri;
  readonly viewColumn: vscode.ViewColumn;
}

interface MoveActiveEditorArguments {
  readonly to: typeof MOVE_EDITOR_ARGUMENT_TO_POSITION;
  readonly by: typeof MOVE_EDITOR_ARGUMENT_BY_GROUP;
  readonly value: number;
}

interface EditorAssociations {
  [pattern: string]: string;
}

type SpikeBenchmarkMode = "readonlyViewer" | "baselineOpenWith";

interface SpikeBenchmarkSample {
  readonly mode: SpikeBenchmarkMode;
  readonly round: number;
  readonly fileIndex: number;
  readonly uri: vscode.Uri;
  readonly durationMs: number;
}

interface SpikeBenchmarkResult {
  readonly mode: SpikeBenchmarkMode;
  readonly firstOpenMs: number;
  readonly switchP50Ms: number;
  readonly switchP95Ms: number;
  readonly samples: readonly SpikeBenchmarkSample[];
}

class MarkdownReadonlyDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}

  dispose(): void {}
}

class MarkdownReadonlyViewerProvider implements vscode.CustomReadonlyEditorProvider<MarkdownReadonlyDocument> {
  private readonly decoder = new TextDecoder("utf-8");

  openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): MarkdownReadonlyDocument {
    return new MarkdownReadonlyDocument(uri);
  }

  async resolveCustomEditor(
    document: MarkdownReadonlyDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    await this.updateReadonlyViewerContent(document.uri, webviewPanel.webview);

    const onDidChangeTextDocumentDisposable = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          void this.updateReadonlyViewerContent(document.uri, webviewPanel.webview);
        }
      },
    );
    const onDidSaveTextDocumentDisposable = vscode.workspace.onDidSaveTextDocument(
      (savedDocument) => {
        if (savedDocument.uri.toString() === document.uri.toString()) {
          void this.updateReadonlyViewerContent(document.uri, webviewPanel.webview);
        }
      },
    );
    const onDidReceiveMessageDisposable = webviewPanel.webview.onDidReceiveMessage(
      async (message: unknown) => {
        if (!isReadonlyViewerSwitchToSourceMessage(message)) {
          return;
        }

        try {
          await openMarkdownSourceEditor(document.uri, webviewPanel.viewColumn);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await vscode.window.showErrorMessage(
            `切回 Markdown 源码编辑失败: ${reason}`,
          );
        }
      },
    );

    webviewPanel.onDidDispose(() => {
      onDidChangeTextDocumentDisposable.dispose();
      onDidSaveTextDocumentDisposable.dispose();
      onDidReceiveMessageDisposable.dispose();
    });
  }

  private async updateReadonlyViewerContent(
    uri: vscode.Uri,
    webview: vscode.Webview,
  ): Promise<void> {
    try {
      const contentBuffer = await vscode.workspace.fs.readFile(uri);
      const markdownContent = this.decoder.decode(contentBuffer);
      webview.html = this.getReadonlyViewerHtml(uri, markdownContent);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      webview.html = this.getReadonlyViewerHtml(
        uri,
        `无法读取 Markdown 文件：${reason}`,
      );
    }
  }

  private getReadonlyViewerHtml(uri: vscode.Uri, markdownContent: string): string {
    const fileLabel = escapeHtml(vscode.workspace.asRelativePath(uri, false));
    const safeContent = escapeHtml(markdownContent);
    const nonce = createNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"
    />
    <style>
      body {
        margin: 0;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-editor-font-family);
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        position: sticky;
        top: 0;
        z-index: 1;
        padding: 8px 12px;
        border-bottom: 1px solid var(--vscode-editorWidget-border);
        background: var(--vscode-editor-background);
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .header-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .switch-button {
        border: none;
        border-radius: 4px;
        padding: 4px 10px;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        cursor: pointer;
        font-size: 12px;
      }
      .switch-button:hover {
        background: var(--vscode-button-hoverBackground);
      }
      pre {
        margin: 0;
        padding: 16px;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.5;
        font-size: var(--vscode-editor-font-size);
      }
    </style>
  </head>
  <body>
    <header>
      <span class="header-label">${fileLabel} · 实验态只读 Viewer</span>
      <button id="switch-source-button" class="switch-button" type="button">切回源码编辑</button>
    </header>
    <pre>${safeContent}</pre>
    <script nonce="${nonce}">
      const vscodeApi = acquireVsCodeApi();
      const switchButton = document.getElementById("switch-source-button");
      if (switchButton) {
        switchButton.addEventListener("click", () => {
          vscodeApi.postMessage({ type: "${READONLY_VIEWER_SWITCH_TO_SOURCE_MESSAGE_TYPE}" });
        });
      }
    </script>
  </body>
</html>`;
  }
}

const detachedPreviewUriMemory = new Set<string>();
let immersivePreviewEnabled = false;
let immersivePreviewTransitionInProgress = false;
let readonlyViewerExperimentEnabled = false;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isReadonlyViewerSwitchToSourceMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidateMessage = message as { readonly type?: unknown };
  return (
    candidateMessage.type === READONLY_VIEWER_SWITCH_TO_SOURCE_MESSAGE_TYPE
  );
}

function createNonce(length = 16): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    nonce += charset.charAt(randomIndex);
  }

  return nonce;
}

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
  return mode === "readonlyViewer"
    ? "Readonly Viewer"
    : "Baseline (source + openWith preview)";
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

function getActiveMarkdownEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  return editor.document.languageId === "markdown" ? editor : undefined;
}

function isReadonlyViewerExperimentEnabledFromConfiguration(): boolean {
  return vscode.workspace
    .getConfiguration(READONLY_VIEWER_EXPERIMENT_CONFIGURATION_SECTION)
    .get<boolean>(READONLY_VIEWER_EXPERIMENT_CONFIGURATION_KEY, false);
}

function getReadonlyViewerAssociationTarget(): vscode.ConfigurationTarget {
  return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

function getEditorAssociationsForTarget(
  inspectedSetting:
    | {
        readonly globalValue?: EditorAssociations;
        readonly workspaceValue?: EditorAssociations;
        readonly workspaceFolderValue?: EditorAssociations;
      }
    | undefined,
  target: vscode.ConfigurationTarget,
): EditorAssociations {
  if (!inspectedSetting) {
    return {};
  }

  switch (target) {
    case vscode.ConfigurationTarget.Workspace:
      return { ...(inspectedSetting.workspaceValue ?? {}) };
    case vscode.ConfigurationTarget.WorkspaceFolder:
      return { ...(inspectedSetting.workspaceFolderValue ?? {}) };
    case vscode.ConfigurationTarget.Global:
    default:
      return { ...(inspectedSetting.globalValue ?? {}) };
  }
}

async function syncReadonlyViewerExperiment(
  context: vscode.ExtensionContext,
): Promise<void> {
  readonlyViewerExperimentEnabled =
    isReadonlyViewerExperimentEnabledFromConfiguration();
  await vscode.commands.executeCommand(
    "setContext",
    READONLY_VIEWER_EXPERIMENT_CONTEXT_KEY,
    readonlyViewerExperimentEnabled,
  );
  await syncReadonlyViewerEditorAssociation(
    context,
    readonlyViewerExperimentEnabled,
  );
}

async function syncReadonlyViewerEditorAssociation(
  context: vscode.ExtensionContext,
  enabled: boolean,
): Promise<void> {
  const target = getReadonlyViewerAssociationTarget();
  const workbenchConfiguration = vscode.workspace.getConfiguration(
    WORKBENCH_CONFIGURATION_SECTION,
  );
  const inspectedAssociations = workbenchConfiguration.inspect<EditorAssociations>(
    EDITOR_ASSOCIATIONS_CONFIGURATION_KEY,
  );
  const scopedAssociations = getEditorAssociationsForTarget(
    inspectedAssociations,
    target,
  );
  const currentMarkdownAssociation =
    scopedAssociations[MARKDOWN_FILE_ASSOCIATION_PATTERN];

  if (enabled) {
    if (currentMarkdownAssociation === MARKDOWN_READONLY_VIEWER_EDITOR) {
      return;
    }

    await context.workspaceState.update(
      PREVIOUS_MARKDOWN_ASSOCIATION_STORAGE_KEY,
      currentMarkdownAssociation ?? null,
    );
    scopedAssociations[MARKDOWN_FILE_ASSOCIATION_PATTERN] =
      MARKDOWN_READONLY_VIEWER_EDITOR;
    await workbenchConfiguration.update(
      EDITOR_ASSOCIATIONS_CONFIGURATION_KEY,
      scopedAssociations,
      target,
    );
    return;
  }

  if (currentMarkdownAssociation !== MARKDOWN_READONLY_VIEWER_EDITOR) {
    return;
  }

  const previousAssociation = context.workspaceState.get<string | null>(
    PREVIOUS_MARKDOWN_ASSOCIATION_STORAGE_KEY,
    null,
  );
  if (previousAssociation) {
    scopedAssociations[MARKDOWN_FILE_ASSOCIATION_PATTERN] = previousAssociation;
  } else {
    delete scopedAssociations[MARKDOWN_FILE_ASSOCIATION_PATTERN];
  }
  await workbenchConfiguration.update(
    EDITOR_ASSOCIATIONS_CONFIGURATION_KEY,
    scopedAssociations,
    target,
  );
  await context.workspaceState.update(
    PREVIOUS_MARKDOWN_ASSOCIATION_STORAGE_KEY,
    undefined,
  );
}

async function setImmersivePreviewEnabled(enabled: boolean): Promise<void> {
  immersivePreviewEnabled = enabled;
  await vscode.commands.executeCommand(
    "setContext",
    IMMERSIVE_PREVIEW_CONTEXT_KEY,
    enabled,
  );
}

async function openMarkdownPreview(
  uri: vscode.Uri,
  viewColumn: vscode.ViewColumn | undefined,
): Promise<void> {
  await vscode.commands.executeCommand("vscode.openWith", uri, MARKDOWN_PREVIEW_EDITOR, {
    viewColumn,
    preview: true,
    preserveFocus: false,
  });
}

async function openMarkdownSourceEditor(
  uri: vscode.Uri,
  viewColumn: vscode.ViewColumn | undefined,
): Promise<void> {
  await vscode.commands.executeCommand("vscode.openWith", uri, "default", {
    viewColumn,
    preview: true,
    preserveFocus: false,
  });
}

async function runSpikeBenchmarkMode(
  mode: SpikeBenchmarkMode,
  markdownUris: readonly vscode.Uri[],
  outputChannel: vscode.OutputChannel,
): Promise<SpikeBenchmarkResult> {
  const viewColumn = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
  const samples: SpikeBenchmarkSample[] = [];
  outputChannel.appendLine(`开始模式：${getSpikeBenchmarkModeLabel(mode)}`);

  for (let round = 1; round <= SPIKE_BENCHMARK_ROUNDS; round += 1) {
    for (let fileIndex = 0; fileIndex < markdownUris.length; fileIndex += 1) {
      const uri = markdownUris[fileIndex];
      const startedAt = Date.now();

      if (mode === "readonlyViewer") {
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
      } else {
        await openMarkdownSourceEditor(uri, viewColumn);
        await openMarkdownPreview(uri, viewColumn);
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

async function runImmersiveReadonlyViewerSpikeBenchmark(): Promise<void> {
  if (!readonlyViewerExperimentEnabled) {
    await vscode.window.showInformationMessage(
      "请先启用 markdownToolkit.experimental.immersiveReadonlyViewer 再执行 D3 benchmark。",
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
    `D3 benchmark started at ${new Date().toISOString()} (${SPIKE_BENCHMARK_FILE_COUNT} files x ${SPIKE_BENCHMARK_ROUNDS} rounds)`,
  );
  outputChannel.appendLine("Files:");
  for (const uri of markdownUris) {
    outputChannel.appendLine(`- ${uri.toString()}`);
  }
  outputChannel.appendLine("");

  try {
    const readonlyViewerResult = await runSpikeBenchmarkMode(
      "readonlyViewer",
      markdownUris,
      outputChannel,
    );
    outputChannel.appendLine("");
    const baselineResult = await runSpikeBenchmarkMode(
      "baselineOpenWith",
      markdownUris,
      outputChannel,
    );

    const firstOpenDelta = getDeltaPercent(
      readonlyViewerResult.firstOpenMs,
      baselineResult.firstOpenMs,
    );
    const switchP95Delta = getDeltaPercent(
      readonlyViewerResult.switchP95Ms,
      baselineResult.switchP95Ms,
    );

    outputChannel.appendLine("");
    outputChannel.appendLine("Summary:");
    outputChannel.appendLine(getSpikeBenchmarkSummaryLine(readonlyViewerResult));
    outputChannel.appendLine(getSpikeBenchmarkSummaryLine(baselineResult));
    outputChannel.appendLine(
      `Readonly vs Baseline delta | first=${roundToTwoDecimals(firstOpenDelta)}% | switch p95=${roundToTwoDecimals(switchP95Delta)}%`,
    );

    await vscode.window.showInformationMessage(
      "D3 benchmark 已完成，详情请查看 Output: Markdown Toolkit Spike Benchmark。",
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`执行 D3 benchmark 失败: ${reason}`);
  }
}

function isMarkdownFile(uri: vscode.Uri | undefined): uri is vscode.Uri {
  if (!uri) {
    return false;
  }

  return uri.path.toLowerCase().endsWith(".md");
}

async function pickMarkdownFileForReadonlyViewer(): Promise<vscode.Uri | undefined> {
  const pickedFileUris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      Markdown: ["md"],
    },
    openLabel: "在只读 Viewer 中打开",
  });

  if (!pickedFileUris || pickedFileUris.length === 0) {
    return undefined;
  }

  return pickedFileUris[0];
}

async function openMarkdownReadonlyViewer(
  resourceUri?: vscode.Uri,
): Promise<void> {
  if (!readonlyViewerExperimentEnabled) {
    await vscode.window.showInformationMessage(
      "实验开关未开启，请先在设置里启用 markdownToolkit.experimental.immersiveReadonlyViewer。",
    );
    return;
  }

  const editor = getActiveMarkdownEditor();
  const targetUriFromResource = isMarkdownFile(resourceUri) ? resourceUri : undefined;
  const targetUriFromEditor = isMarkdownFile(editor?.document.uri)
    ? editor.document.uri
    : undefined;
  const targetUri =
    targetUriFromResource ??
    targetUriFromEditor ??
    (await pickMarkdownFileForReadonlyViewer());
  if (!targetUri) {
    return;
  }
  const targetViewColumn = editor?.viewColumn ?? vscode.window.activeTextEditor?.viewColumn;

  try {
    await vscode.commands.executeCommand(
      "vscode.openWith",
      targetUri,
      MARKDOWN_READONLY_VIEWER_EDITOR,
      {
        viewColumn: targetViewColumn,
        preview: true,
        preserveFocus: false,
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`打开 Markdown 只读 Viewer 失败: ${reason}`);
  }
}

function getActiveMarkdownCustomTab(
  viewType: string,
): ActiveMarkdownPreview | undefined {
  const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
  const activeTab = activeTabGroup.activeTab;
  if (!activeTab || !(activeTab.input instanceof vscode.TabInputCustom)) {
    return undefined;
  }

  if (activeTab.input.viewType !== viewType) {
    return undefined;
  }

  return {
    uri: activeTab.input.uri,
    viewColumn: activeTabGroup.viewColumn,
  };
}

function getMarkdownPreviewUriFromTab(tab: vscode.Tab): vscode.Uri | undefined {
  if (!(tab.input instanceof vscode.TabInputCustom)) {
    return undefined;
  }

  if (tab.input.viewType !== MARKDOWN_PREVIEW_EDITOR) {
    return undefined;
  }

  return tab.input.uri;
}

function rememberDetachedPreview(uri: vscode.Uri): void {
  const key = uri.toString();
  detachedPreviewUriMemory.delete(key);
  detachedPreviewUriMemory.add(key);

  while (detachedPreviewUriMemory.size > MAX_DETACHED_PREVIEW_MEMORY) {
    const oldest = detachedPreviewUriMemory.values().next().value;
    if (!oldest) {
      break;
    }

    detachedPreviewUriMemory.delete(oldest);
  }
}

function findReusablePreviewGroupPosition(): number | undefined {
  const groups = vscode.window.tabGroups.all;
  const activeGroup = vscode.window.tabGroups.activeTabGroup;
  let fallbackPosition: number | undefined;

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (group === activeGroup) {
      continue;
    }

    let hasAnyMarkdownPreview = false;
    let hasRememberedPreview = false;

    for (const tab of group.tabs) {
      const previewUri = getMarkdownPreviewUriFromTab(tab);
      if (!previewUri) {
        continue;
      }

      hasAnyMarkdownPreview = true;
      if (detachedPreviewUriMemory.has(previewUri.toString())) {
        hasRememberedPreview = true;
        break;
      }
    }

    if (hasRememberedPreview) {
      return index + 1;
    }

    if (hasAnyMarkdownPreview && fallbackPosition === undefined) {
      fallbackPosition = index + 1;
    }
  }

  return fallbackPosition;
}

async function tryMoveActiveEditorToReusablePreviewGroup(): Promise<boolean> {
  const targetPosition = findReusablePreviewGroupPosition();
  if (!targetPosition) {
    return false;
  }

  const argumentsForMove: MoveActiveEditorArguments = {
    to: MOVE_EDITOR_ARGUMENT_TO_POSITION,
    by: MOVE_EDITOR_ARGUMENT_BY_GROUP,
    value: targetPosition,
  };

  try {
    await vscode.commands.executeCommand(
      MOVE_ACTIVE_EDITOR_COMMAND,
      argumentsForMove,
    );
    return true;
  } catch {
    return false;
  }
}

async function openPreviewInPlace(): Promise<void> {
  const editor = getActiveMarkdownEditor();
  if (!editor) {
    await vscode.window.showWarningMessage("请先打开一个 Markdown 文件。");
    return;
  }

  const previousImmersiveState = immersivePreviewEnabled;
  try {
    await setImmersivePreviewEnabled(true);
    await openMarkdownPreview(editor.document.uri, editor.viewColumn);
  } catch (error) {
    if (immersivePreviewEnabled !== previousImmersiveState) {
      await setImmersivePreviewEnabled(previousImmersiveState);
    }
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`打开 Markdown 预览失败: ${reason}`);
  }
}

async function openFloatingPreview(): Promise<void> {
  const activePreview = getActiveMarkdownPreview();
  if (activePreview) {
    try {
      const reusedExistingGroup = await tryMoveActiveEditorToReusablePreviewGroup();
      if (!reusedExistingGroup) {
        await vscode.commands.executeCommand(
          "workbench.action.moveEditorToNewWindow",
        );
      }
      rememberDetachedPreview(activePreview.uri);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(`打开浮动 Markdown 预览失败: ${reason}`);
    }
    return;
  }

  const editor = getActiveMarkdownEditor();
  if (!editor) {
    await vscode.window.showWarningMessage(
      "请先打开一个 Markdown 文件或激活 Markdown 预览。",
    );
    return;
  }

  try {
    // Replace the markdown editor first to avoid dual source+preview sync jitter.
    await openMarkdownPreview(editor.document.uri, editor.viewColumn);
    const reusedExistingGroup = await tryMoveActiveEditorToReusablePreviewGroup();
    if (!reusedExistingGroup) {
      await vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
    }
    rememberDetachedPreview(editor.document.uri);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`打开浮动 Markdown 预览失败: ${reason}`);
  }
}

function getActiveMarkdownPreview(): ActiveMarkdownPreview | undefined {
  return getActiveMarkdownCustomTab(MARKDOWN_PREVIEW_EDITOR);
}

function getActiveMarkdownReadonlyViewer(): ActiveMarkdownPreview | undefined {
  return getActiveMarkdownCustomTab(MARKDOWN_READONLY_VIEWER_EDITOR);
}

async function switchToSourceEditor(): Promise<void> {
  const readonlyViewer = getActiveMarkdownReadonlyViewer();
  if (!readonlyViewer) {
    await vscode.window.showWarningMessage("当前不在 Markdown 只读 Viewer 中。");
    return;
  }

  try {
    await openMarkdownSourceEditor(readonlyViewer.uri, readonlyViewer.viewColumn);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`切回 Markdown 源码编辑失败: ${reason}`);
  }
}

async function exitPreviewInPlace(): Promise<void> {
  const hadImmersiveSession = immersivePreviewEnabled;
  const preview = getActiveMarkdownPreview();
  try {
    await setImmersivePreviewEnabled(false);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`退出 Markdown 阅读模式失败: ${reason}`);
    return;
  }

  if (!preview) {
    if (!hadImmersiveSession) {
      await vscode.window.showWarningMessage("当前不在 Markdown 阅读模式。");
    }
    return;
  }

  try {
    await openMarkdownSourceEditor(preview.uri, preview.viewColumn);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`退出 Markdown 阅读模式失败: ${reason}`);
  }
}

async function handleActiveTextEditorChanged(
  editor: vscode.TextEditor | undefined,
): Promise<void> {
  if (
    !immersivePreviewEnabled ||
    immersivePreviewTransitionInProgress ||
    !editor ||
    editor.document.languageId !== "markdown"
  ) {
    return;
  }

  immersivePreviewTransitionInProgress = true;
  try {
    await openMarkdownPreview(editor.document.uri, editor.viewColumn);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`自动切换 Markdown 预览失败: ${reason}`);
  } finally {
    immersivePreviewTransitionInProgress = false;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  void vscode.commands.executeCommand(
    "setContext",
    IMMERSIVE_PREVIEW_CONTEXT_KEY,
    false,
  );
  void vscode.commands.executeCommand(
    "setContext",
    READONLY_VIEWER_EXPERIMENT_CONTEXT_KEY,
    false,
  );
  void syncReadonlyViewerExperiment(context).catch(async (error) => {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`初始化实验态只读 Viewer 失败: ${reason}`);
  });
  const readonlyViewerProviderDisposable = vscode.window.registerCustomEditorProvider(
    MARKDOWN_READONLY_VIEWER_EDITOR,
    new MarkdownReadonlyViewerProvider(),
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: true,
    },
  );
  const openDisposable = vscode.commands.registerCommand(
    OPEN_PREVIEW_IN_PLACE_COMMAND,
    openPreviewInPlace,
  );
  const floatingDisposable = vscode.commands.registerCommand(
    OPEN_FLOATING_PREVIEW_COMMAND,
    openFloatingPreview,
  );
  const exitDisposable = vscode.commands.registerCommand(
    EXIT_PREVIEW_IN_PLACE_COMMAND,
    exitPreviewInPlace,
  );
  const openReadonlyViewerDisposable = vscode.commands.registerCommand(
    OPEN_READONLY_VIEWER_COMMAND,
    openMarkdownReadonlyViewer,
  );
  const switchToSourceEditorDisposable = vscode.commands.registerCommand(
    SWITCH_TO_SOURCE_EDITOR_COMMAND,
    switchToSourceEditor,
  );
  const runSpikeBenchmarkDisposable = vscode.commands.registerCommand(
    RUN_SPIKE_BENCHMARK_COMMAND,
    runImmersiveReadonlyViewerSpikeBenchmark,
  );
  const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      void handleActiveTextEditorChanged(editor);
    },
  );
  const configurationChangeDisposable = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (
        !event.affectsConfiguration(
          READONLY_VIEWER_EXPERIMENT_FULL_CONFIGURATION_KEY,
        )
      ) {
        return;
      }

      void syncReadonlyViewerExperiment(context).catch(async (error) => {
        const reason = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(
          `同步实验态只读 Viewer 设置失败: ${reason}`,
        );
      });
    },
  );

  context.subscriptions.push(
    readonlyViewerProviderDisposable,
    openDisposable,
    floatingDisposable,
    exitDisposable,
    openReadonlyViewerDisposable,
    switchToSourceEditorDisposable,
    runSpikeBenchmarkDisposable,
    activeEditorChangeDisposable,
    configurationChangeDisposable,
  );
}

export function deactivate(): void {}
