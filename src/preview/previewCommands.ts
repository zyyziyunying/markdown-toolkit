import * as vscode from "vscode";
import {
  IMMERSIVE_PREVIEW_CONTEXT_KEY,
  MARKDOWN_PREVIEW_EDITOR,
  MARKDOWN_READONLY_VIEWER_EDITOR,
} from "../shared/constants";
import { ActiveMarkdownPreview } from "../shared/types";
import { RuntimeState } from "../state/runtimeState";
import {
  rememberDetachedPreview,
  tryMoveActiveEditorToReusablePreviewGroup,
} from "./groupReuse";

async function setImmersivePreviewEnabled(
  state: RuntimeState,
  enabled: boolean,
): Promise<void> {
  state.immersivePreviewEnabled = enabled;
  await vscode.commands.executeCommand(
    "setContext",
    IMMERSIVE_PREVIEW_CONTEXT_KEY,
    enabled,
  );
}

export async function openMarkdownPreview(
  uri: vscode.Uri,
  viewColumn: vscode.ViewColumn | undefined,
): Promise<void> {
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    MARKDOWN_PREVIEW_EDITOR,
    {
      viewColumn,
      preview: true,
      preserveFocus: false,
    },
  );
}

export async function openMarkdownSourceEditor(
  uri: vscode.Uri,
  viewColumn: vscode.ViewColumn | undefined,
): Promise<void> {
  await vscode.commands.executeCommand("vscode.openWith", uri, "default", {
    viewColumn,
    preview: true,
    preserveFocus: false,
  });
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

export function getActiveMarkdownEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  return editor.document.languageId === "markdown" ? editor : undefined;
}

function getActiveMarkdownPreview(): ActiveMarkdownPreview | undefined {
  return getActiveMarkdownCustomTab(MARKDOWN_PREVIEW_EDITOR);
}

function getActiveMarkdownReadonlyViewer(): ActiveMarkdownPreview | undefined {
  return getActiveMarkdownCustomTab(MARKDOWN_READONLY_VIEWER_EDITOR);
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

export async function openMarkdownReadonlyViewer(
  state: RuntimeState,
  resourceUri?: vscode.Uri,
): Promise<void> {
  if (!state.readonlyViewerExperimentEnabled) {
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

export async function openPreviewInPlace(state: RuntimeState): Promise<void> {
  const editor = getActiveMarkdownEditor();
  if (!editor) {
    await vscode.window.showWarningMessage("请先打开一个 Markdown 文件。");
    return;
  }

  const previousImmersiveState = state.immersivePreviewEnabled;
  try {
    await setImmersivePreviewEnabled(state, true);
    await openMarkdownPreview(editor.document.uri, editor.viewColumn);
  } catch (error) {
    if (state.immersivePreviewEnabled !== previousImmersiveState) {
      await setImmersivePreviewEnabled(state, previousImmersiveState);
    }
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`打开 Markdown 预览失败: ${reason}`);
  }
}

export async function openFloatingPreview(state: RuntimeState): Promise<void> {
  const activePreview = getActiveMarkdownPreview();
  if (activePreview) {
    try {
      const reusedExistingGroup =
        await tryMoveActiveEditorToReusablePreviewGroup(state);
      if (!reusedExistingGroup) {
        await vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
      }
      rememberDetachedPreview(state, activePreview.uri);
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
    const reusedExistingGroup =
      await tryMoveActiveEditorToReusablePreviewGroup(state);
    if (!reusedExistingGroup) {
      await vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
    }
    rememberDetachedPreview(state, editor.document.uri);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`打开浮动 Markdown 预览失败: ${reason}`);
  }
}

export async function switchToSourceEditor(): Promise<void> {
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

export async function exitPreviewInPlace(state: RuntimeState): Promise<void> {
  const hadImmersiveSession = state.immersivePreviewEnabled;
  const preview = getActiveMarkdownPreview();
  try {
    await setImmersivePreviewEnabled(state, false);
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

export async function handleActiveTextEditorChanged(
  state: RuntimeState,
  editor: vscode.TextEditor | undefined,
): Promise<void> {
  if (
    !state.immersivePreviewEnabled ||
    state.immersivePreviewTransitionInProgress ||
    !editor ||
    editor.document.languageId !== "markdown"
  ) {
    return;
  }

  state.immersivePreviewTransitionInProgress = true;
  try {
    await openMarkdownPreview(editor.document.uri, editor.viewColumn);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`自动切换 Markdown 预览失败: ${reason}`);
  } finally {
    state.immersivePreviewTransitionInProgress = false;
  }
}
