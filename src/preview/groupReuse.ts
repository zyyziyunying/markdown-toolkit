import * as vscode from "vscode";
import {
  MARKDOWN_PREVIEW_EDITOR,
  MAX_DETACHED_PREVIEW_MEMORY,
  MOVE_ACTIVE_EDITOR_COMMAND,
  MOVE_EDITOR_ARGUMENT_BY_GROUP,
  MOVE_EDITOR_ARGUMENT_TO_POSITION,
} from "../shared/constants";
import { MoveActiveEditorArguments } from "../shared/types";
import { RuntimeState } from "../state/runtimeState";

function getMarkdownPreviewUriFromTab(tab: vscode.Tab): vscode.Uri | undefined {
  if (!(tab.input instanceof vscode.TabInputCustom)) {
    return undefined;
  }

  if (tab.input.viewType !== MARKDOWN_PREVIEW_EDITOR) {
    return undefined;
  }

  return tab.input.uri;
}

export function rememberDetachedPreview(
  state: RuntimeState,
  uri: vscode.Uri,
): void {
  const key = uri.toString();
  state.detachedPreviewUriMemory.delete(key);
  state.detachedPreviewUriMemory.add(key);

  while (state.detachedPreviewUriMemory.size > MAX_DETACHED_PREVIEW_MEMORY) {
    const oldest = state.detachedPreviewUriMemory.values().next().value;
    if (!oldest) {
      break;
    }

    state.detachedPreviewUriMemory.delete(oldest);
  }
}

function findReusablePreviewGroupPosition(
  state: RuntimeState,
): number | undefined {
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
      if (state.detachedPreviewUriMemory.has(previewUri.toString())) {
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

export async function tryMoveActiveEditorToReusablePreviewGroup(
  state: RuntimeState,
): Promise<boolean> {
  const targetPosition = findReusablePreviewGroupPosition(state);
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
