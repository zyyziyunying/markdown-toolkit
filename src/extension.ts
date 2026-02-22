import * as vscode from "vscode";

const OPEN_PREVIEW_IN_PLACE_COMMAND = "markdownToolkit.openPreviewInPlace";
const EXIT_PREVIEW_IN_PLACE_COMMAND = "markdownToolkit.exitPreviewInPlace";
const MARKDOWN_PREVIEW_EDITOR = "vscode.markdown.preview.editor";

interface ActiveMarkdownPreview {
  readonly uri: vscode.Uri;
  readonly viewColumn: vscode.ViewColumn;
}

function getActiveMarkdownEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  return editor.document.languageId === "markdown" ? editor : undefined;
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
  const exitDisposable = vscode.commands.registerCommand(
    EXIT_PREVIEW_IN_PLACE_COMMAND,
    exitPreviewInPlace,
  );

  context.subscriptions.push(openDisposable, exitDisposable);
}

export function deactivate(): void {}
