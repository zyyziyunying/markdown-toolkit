import * as vscode from "vscode";

const OPEN_PREVIEW_IN_PLACE_COMMAND = "markdownToolkit.openPreviewInPlace";
const MARKDOWN_PREVIEW_EDITOR = "vscode.markdown.preview.editor";

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

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    OPEN_PREVIEW_IN_PLACE_COMMAND,
    openPreviewInPlace,
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
