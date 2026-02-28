import * as vscode from "vscode";

const OPEN_PREVIEW_IN_PLACE_COMMAND = "markdownToolkit.openPreviewInPlace";
const OPEN_FLOATING_PREVIEW_COMMAND = "markdownToolkit.openFloatingPreview";
const EXIT_PREVIEW_IN_PLACE_COMMAND = "markdownToolkit.exitPreviewInPlace";
const MARKDOWN_PREVIEW_EDITOR = "vscode.markdown.preview.editor";
const MOVE_ACTIVE_EDITOR_COMMAND = "moveActiveEditor";
const MOVE_EDITOR_ARGUMENT_BY_GROUP = "group";
const MOVE_EDITOR_ARGUMENT_TO_POSITION = "position";
const MAX_DETACHED_PREVIEW_MEMORY = 32;

interface ActiveMarkdownPreview {
  readonly uri: vscode.Uri;
  readonly viewColumn: vscode.ViewColumn;
}

interface MoveActiveEditorArguments {
  readonly to: typeof MOVE_EDITOR_ARGUMENT_TO_POSITION;
  readonly by: typeof MOVE_EDITOR_ARGUMENT_BY_GROUP;
  readonly value: number;
}

const detachedPreviewUriMemory = new Set<string>();

function getActiveMarkdownEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  return editor.document.languageId === "markdown" ? editor : undefined;
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

  try {
    await vscode.commands.executeCommand(
      "vscode.openWith",
      editor.document.uri,
      MARKDOWN_PREVIEW_EDITOR,
      {
        viewColumn: editor.viewColumn,
        preview: true,
        preserveFocus: false,
      },
    );
  } catch (error) {
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
    await vscode.commands.executeCommand(
      "vscode.openWith",
      editor.document.uri,
      MARKDOWN_PREVIEW_EDITOR,
      {
        // Replace the markdown editor first to avoid dual source+preview sync jitter.
        viewColumn: editor.viewColumn,
        preview: true,
        preserveFocus: false,
      },
    );
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
  const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
  const activeTab = activeTabGroup.activeTab;
  if (!activeTab) {
    return undefined;
  }

  if (!(activeTab.input instanceof vscode.TabInputCustom)) {
    return undefined;
  }

  if (activeTab.input.viewType !== MARKDOWN_PREVIEW_EDITOR) {
    return undefined;
  }

  return {
    uri: activeTab.input.uri,
    viewColumn: activeTabGroup.viewColumn,
  };
}

async function exitPreviewInPlace(): Promise<void> {
  const preview = getActiveMarkdownPreview();
  if (!preview) {
    await vscode.window.showWarningMessage("当前不在 Markdown 阅读模式。");
    return;
  }

  try {
    await vscode.commands.executeCommand(
      "vscode.openWith",
      preview.uri,
      "default",
      {
        viewColumn: preview.viewColumn,
        preview: true,
        preserveFocus: false,
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`退出 Markdown 阅读模式失败: ${reason}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
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

  context.subscriptions.push(openDisposable, floatingDisposable, exitDisposable);
}

export function deactivate(): void {}
