import { ReadonlyViewerRenderMode } from "../shared/types";

export interface RuntimeState {
  readonly detachedPreviewUriMemory: Set<string>;
  immersivePreviewEnabled: boolean;
  immersivePreviewTransitionInProgress: boolean;
  readonlyViewerExperimentEnabled: boolean;
  readonlyViewerRenderModeEnabled: boolean;
  readonlyViewerRenderModeOverride: ReadonlyViewerRenderMode | undefined;
}

export function createRuntimeState(): RuntimeState {
  return {
    detachedPreviewUriMemory: new Set<string>(),
    immersivePreviewEnabled: false,
    immersivePreviewTransitionInProgress: false,
    readonlyViewerExperimentEnabled: false,
    readonlyViewerRenderModeEnabled: false,
    readonlyViewerRenderModeOverride: undefined,
  };
}

export function getEffectiveReadonlyViewerRenderMode(
  state: RuntimeState,
): ReadonlyViewerRenderMode {
  if (state.readonlyViewerRenderModeOverride) {
    return state.readonlyViewerRenderModeOverride;
  }

  return state.readonlyViewerRenderModeEnabled ? "rendered" : "plainText";
}
