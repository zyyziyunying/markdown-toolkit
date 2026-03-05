import * as vscode from "vscode";
import { READONLY_VIEWER_SWITCH_TO_SOURCE_MESSAGE_TYPE } from "../shared/constants";
import { ReadonlyViewerRenderMode } from "../shared/types";
import {
  getEffectiveReadonlyViewerRenderMode,
  RuntimeState,
} from "../state/runtimeState";
import { renderMarkdownWithFallback } from "./fallbackRenderer";
import {
  createNonce,
  escapeHtml,
  extractBodyInnerHtml,
  getParentDirectoryUri,
  isReadonlyViewerSwitchToSourceMessage,
} from "./webviewUtils";

type OpenMarkdownSourceEditor = (
  uri: vscode.Uri,
  viewColumn: vscode.ViewColumn | undefined,
) => Promise<void>;

export class MarkdownReadonlyDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}

  dispose(): void {}
}

export class MarkdownReadonlyViewerProvider
  implements vscode.CustomReadonlyEditorProvider<MarkdownReadonlyDocument>
{
  private readonly decoder = new TextDecoder("utf-8");
  private markdownApiRenderCommandUnavailable = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly state: RuntimeState,
    private readonly openMarkdownSourceEditor: OpenMarkdownSourceEditor,
  ) {}

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
    const localResourceRoots = [vscode.Uri.joinPath(this.extensionUri, "media")];
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (workspaceFolder) {
      localResourceRoots.push(workspaceFolder.uri);
    }
    localResourceRoots.push(getParentDirectoryUri(document.uri));

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots,
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
          await this.openMarkdownSourceEditor(document.uri, webviewPanel.viewColumn);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await vscode.window.showErrorMessage(`切回 Markdown 源码编辑失败: ${reason}`);
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
      const renderMode = getEffectiveReadonlyViewerRenderMode(this.state);
      const renderedMarkdownHtml =
        renderMode === "rendered"
          ? await this.renderMarkdownToHtml(markdownContent)
          : undefined;
      webview.html = this.getReadonlyViewerHtml(
        uri,
        markdownContent,
        webview,
        renderMode,
        renderedMarkdownHtml,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      webview.html = this.getReadonlyViewerHtml(
        uri,
        `无法读取 Markdown 文件：${reason}`,
        webview,
        "plainText",
      );
    }
  }

  private async renderMarkdownToHtml(markdownContent: string): Promise<string> {
    const renderedHtml = await this.tryRenderMarkdownWithBuiltinApi(markdownContent);
    if (renderedHtml) {
      return renderedHtml;
    }

    return renderMarkdownWithFallback(markdownContent);
  }

  private async tryRenderMarkdownWithBuiltinApi(
    markdownContent: string,
  ): Promise<string | undefined> {
    if (this.markdownApiRenderCommandUnavailable) {
      return undefined;
    }

    try {
      const rendered = await vscode.commands.executeCommand<unknown>(
        "markdown.api.render",
        markdownContent,
      );
      return this.extractRenderedMarkdownHtml(rendered);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const reasonLowerCase = reason.toLowerCase();
      if (
        reasonLowerCase.includes("markdown.api.render") &&
        reasonLowerCase.includes("not found")
      ) {
        this.markdownApiRenderCommandUnavailable = true;
      }
      return undefined;
    }
  }

  private extractRenderedMarkdownHtml(rendered: unknown): string | undefined {
    if (typeof rendered === "string") {
      return extractBodyInnerHtml(rendered);
    }

    if (!rendered || typeof rendered !== "object") {
      return undefined;
    }

    const candidate = rendered as { readonly html?: unknown };
    if (typeof candidate.html !== "string") {
      return undefined;
    }

    return extractBodyInnerHtml(candidate.html);
  }

  private getReadonlyViewerHtml(
    uri: vscode.Uri,
    markdownContent: string,
    webview: vscode.Webview,
    renderMode: ReadonlyViewerRenderMode,
    renderedMarkdownHtml?: string,
  ): string {
    const fileLabel = escapeHtml(vscode.workspace.asRelativePath(uri, false));
    const safeContent = escapeHtml(markdownContent);
    const modeLabel = renderMode === "rendered" ? "渲染模式" : "纯文本模式";
    const parentDirectoryUri = webview.asWebviewUri(getParentDirectoryUri(uri));
    const baseHref = parentDirectoryUri.toString().endsWith("/")
      ? parentDirectoryUri.toString()
      : `${parentDirectoryUri.toString()}/`;
    const nonce = createNonce();
    const mermaidCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "mermaidPreview.css"),
    );
    const mermaidUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "mermaid.min.js"),
    );
    const mermaidInteractionUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "mermaidInteraction.js"),
    );
    const mermaidFocusModeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "mermaidFocusMode.js"),
    );
    const mermaidRendererUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "mermaidRenderer.js"),
    );
    const mermaidPreviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "mermaidPreview.js"),
    );
    const contentHtml =
      renderMode === "rendered"
        ? `<main class="markdown-body">${renderedMarkdownHtml ?? `<pre class="plain-text">${safeContent}</pre>`}</main>`
        : `<pre class="plain-text">${safeContent}</pre>`;
    const renderedAssets =
      renderMode === "rendered"
        ? `
    <base href="${baseHref}" />
    <link rel="stylesheet" href="${mermaidCssUri}" />
    <script nonce="${nonce}" src="${mermaidUri}"></script>
    <script nonce="${nonce}" src="${mermaidInteractionUri}"></script>
    <script nonce="${nonce}" src="${mermaidFocusModeUri}"></script>
    <script nonce="${nonce}" src="${mermaidRendererUri}"></script>
    <script nonce="${nonce}" src="${mermaidPreviewUri}"></script>`
        : "";

    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'"
    />
${renderedAssets}
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
      .header-mode {
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--vscode-panel-border);
        color: var(--vscode-descriptionForeground);
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
      .viewer-content {
        padding: 16px;
      }
      .plain-text {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.5;
        font-size: var(--vscode-editor-font-size);
      }
      .markdown-body {
        line-height: 1.65;
        font-size: var(--vscode-editor-font-size);
      }
      .markdown-body h1,
      .markdown-body h2,
      .markdown-body h3,
      .markdown-body h4,
      .markdown-body h5,
      .markdown-body h6 {
        margin-top: 1.2em;
        margin-bottom: 0.5em;
      }
      .markdown-body code {
        font-family: var(--vscode-editor-font-family);
      }
      .markdown-body pre {
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.12));
      }
      .markdown-body table {
        border-collapse: collapse;
        margin: 1em 0;
      }
      .markdown-body th,
      .markdown-body td {
        border: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.35));
        padding: 6px 10px;
      }
      .markdown-body blockquote {
        margin: 1em 0;
        padding-left: 12px;
        border-left: 3px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.35));
        color: var(--vscode-descriptionForeground);
      }
      .markdown-body img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    <header>
      <span class="header-label">${fileLabel} · 实验态只读 Viewer</span>
      <span class="header-mode">${modeLabel}</span>
      <button id="switch-source-button" class="switch-button" type="button">切回源码编辑</button>
    </header>
    <section class="viewer-content">${contentHtml}</section>
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
