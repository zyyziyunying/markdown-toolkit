import * as vscode from "vscode";
import {
  MOVE_EDITOR_ARGUMENT_BY_GROUP,
  MOVE_EDITOR_ARGUMENT_TO_POSITION,
} from "./constants";

export interface ActiveMarkdownPreview {
  readonly uri: vscode.Uri;
  readonly viewColumn: vscode.ViewColumn;
}

export interface MoveActiveEditorArguments {
  readonly to: typeof MOVE_EDITOR_ARGUMENT_TO_POSITION;
  readonly by: typeof MOVE_EDITOR_ARGUMENT_BY_GROUP;
  readonly value: number;
}

export interface EditorAssociations {
  [pattern: string]: string;
}

export type ReadonlyViewerRenderMode = "plainText" | "rendered";

export type SpikeBenchmarkMode =
  | "readonlyViewerPlainText"
  | "readonlyViewerRendered"
  | "baselineOpenWith";

export interface SpikeBenchmarkSample {
  readonly mode: SpikeBenchmarkMode;
  readonly round: number;
  readonly fileIndex: number;
  readonly uri: vscode.Uri;
  readonly durationMs: number;
}

export interface SpikeBenchmarkResult {
  readonly mode: SpikeBenchmarkMode;
  readonly firstOpenMs: number;
  readonly switchP50Ms: number;
  readonly switchP95Ms: number;
  readonly samples: readonly SpikeBenchmarkSample[];
}
