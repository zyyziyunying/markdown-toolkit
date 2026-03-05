import * as vscode from "vscode";
import { READONLY_VIEWER_SWITCH_TO_SOURCE_MESSAGE_TYPE } from "../shared/constants";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getParentDirectoryUri(uri: vscode.Uri): vscode.Uri {
  const lastSlashIndex = uri.path.lastIndexOf("/");
  const parentPath = lastSlashIndex > 0 ? uri.path.slice(0, lastSlashIndex) : "/";
  return uri.with({ path: parentPath });
}

export function extractBodyInnerHtml(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

export function isReadonlyViewerSwitchToSourceMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidateMessage = message as { readonly type?: unknown };
  return candidateMessage.type === READONLY_VIEWER_SWITCH_TO_SOURCE_MESSAGE_TYPE;
}

export function createNonce(length = 16): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    nonce += charset.charAt(randomIndex);
  }

  return nonce;
}
