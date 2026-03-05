import * as vscode from "vscode";
import { runImmersiveReadonlyViewerSpikeBenchmark } from "./benchmark/spikeBenchmark";
import { syncReadonlyViewerExperiment } from "./readonlyViewer/configSync";
import { MarkdownReadonlyViewerProvider } from "./readonlyViewer/provider";
import {
  exitPreviewInPlace,
  handleActiveTextEditorChanged,
  openFloatingPreview,
  openMarkdownReadonlyViewer,
  openMarkdownSourceEditor,
  openPreviewInPlace,
  switchToSourceEditor,
} from "./preview/previewCommands";
import {
  EXIT_PREVIEW_IN_PLACE_COMMAND,
  IMMERSIVE_PREVIEW_CONTEXT_KEY,
  OPEN_FLOATING_PREVIEW_COMMAND,
  OPEN_PREVIEW_IN_PLACE_COMMAND,
  OPEN_READONLY_VIEWER_COMMAND,
  READONLY_VIEWER_EXPERIMENT_CONTEXT_KEY,
  READONLY_VIEWER_EXPERIMENT_FULL_CONFIGURATION_KEY,
  READONLY_VIEWER_RENDER_MODE_CONTEXT_KEY,
  READONLY_VIEWER_RENDER_MODE_FULL_CONFIGURATION_KEY,
  RUN_SPIKE_BENCHMARK_COMMAND,
  SWITCH_TO_SOURCE_EDITOR_COMMAND,
  MARKDOWN_READONLY_VIEWER_EDITOR,
} from "./shared/constants";
import { createRuntimeState } from "./state/runtimeState";

export function activate(context: vscode.ExtensionContext): void {
  const runtimeState = createRuntimeState();

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
  void vscode.commands.executeCommand(
    "setContext",
    READONLY_VIEWER_RENDER_MODE_CONTEXT_KEY,
    false,
  );
  void syncReadonlyViewerExperiment(context, runtimeState).catch(async (error) => {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`初始化实验态只读 Viewer 失败: ${reason}`);
  });

  const readonlyViewerProviderDisposable = vscode.window.registerCustomEditorProvider(
    MARKDOWN_READONLY_VIEWER_EDITOR,
    new MarkdownReadonlyViewerProvider(
      context.extensionUri,
      runtimeState,
      openMarkdownSourceEditor,
    ),
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: true,
    },
  );
  const openDisposable = vscode.commands.registerCommand(
    OPEN_PREVIEW_IN_PLACE_COMMAND,
    () => openPreviewInPlace(runtimeState),
  );
  const floatingDisposable = vscode.commands.registerCommand(
    OPEN_FLOATING_PREVIEW_COMMAND,
    () => openFloatingPreview(runtimeState),
  );
  const exitDisposable = vscode.commands.registerCommand(
    EXIT_PREVIEW_IN_PLACE_COMMAND,
    () => exitPreviewInPlace(runtimeState),
  );
  const openReadonlyViewerDisposable = vscode.commands.registerCommand(
    OPEN_READONLY_VIEWER_COMMAND,
    (resourceUri?: vscode.Uri) =>
      openMarkdownReadonlyViewer(runtimeState, resourceUri),
  );
  const switchToSourceEditorDisposable = vscode.commands.registerCommand(
    SWITCH_TO_SOURCE_EDITOR_COMMAND,
    switchToSourceEditor,
  );
  const runSpikeBenchmarkDisposable = vscode.commands.registerCommand(
    RUN_SPIKE_BENCHMARK_COMMAND,
    () => runImmersiveReadonlyViewerSpikeBenchmark(runtimeState),
  );
  const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      void handleActiveTextEditorChanged(runtimeState, editor);
    },
  );
  const configurationChangeDisposable = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (
        !event.affectsConfiguration(
          READONLY_VIEWER_EXPERIMENT_FULL_CONFIGURATION_KEY,
        ) &&
        !event.affectsConfiguration(
          READONLY_VIEWER_RENDER_MODE_FULL_CONFIGURATION_KEY,
        )
      ) {
        return;
      }

      void syncReadonlyViewerExperiment(context, runtimeState).catch(async (error) => {
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
