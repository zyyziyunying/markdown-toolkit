import * as vscode from "vscode";
import {
  EDITOR_ASSOCIATIONS_CONFIGURATION_KEY,
  MARKDOWN_FILE_ASSOCIATION_PATTERN,
  MARKDOWN_READONLY_VIEWER_EDITOR,
  PREVIOUS_MARKDOWN_ASSOCIATION_STORAGE_KEY,
  READONLY_VIEWER_EXPERIMENT_CONFIGURATION_KEY,
  READONLY_VIEWER_EXPERIMENT_CONFIGURATION_SECTION,
  READONLY_VIEWER_EXPERIMENT_CONTEXT_KEY,
  READONLY_VIEWER_RENDER_MODE_CONFIGURATION_KEY,
  READONLY_VIEWER_RENDER_MODE_CONTEXT_KEY,
  WORKBENCH_CONFIGURATION_SECTION,
} from "../shared/constants";
import { EditorAssociations } from "../shared/types";
import { RuntimeState } from "../state/runtimeState";

function isReadonlyViewerExperimentEnabledFromConfiguration(): boolean {
  return vscode.workspace
    .getConfiguration(READONLY_VIEWER_EXPERIMENT_CONFIGURATION_SECTION)
    .get<boolean>(READONLY_VIEWER_EXPERIMENT_CONFIGURATION_KEY, false);
}

function isReadonlyViewerRenderModeEnabledFromConfiguration(): boolean {
  return vscode.workspace
    .getConfiguration(READONLY_VIEWER_EXPERIMENT_CONFIGURATION_SECTION)
    .get<boolean>(READONLY_VIEWER_RENDER_MODE_CONFIGURATION_KEY, false);
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

export async function syncReadonlyViewerExperiment(
  context: vscode.ExtensionContext,
  state: RuntimeState,
): Promise<void> {
  state.readonlyViewerExperimentEnabled =
    isReadonlyViewerExperimentEnabledFromConfiguration();
  state.readonlyViewerRenderModeEnabled =
    isReadonlyViewerRenderModeEnabledFromConfiguration();
  await vscode.commands.executeCommand(
    "setContext",
    READONLY_VIEWER_EXPERIMENT_CONTEXT_KEY,
    state.readonlyViewerExperimentEnabled,
  );
  await vscode.commands.executeCommand(
    "setContext",
    READONLY_VIEWER_RENDER_MODE_CONTEXT_KEY,
    state.readonlyViewerRenderModeEnabled,
  );
  await syncReadonlyViewerEditorAssociation(
    context,
    state.readonlyViewerExperimentEnabled,
  );
}
