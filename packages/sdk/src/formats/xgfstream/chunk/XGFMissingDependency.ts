import type {XGFChunkDependencyKind} from "./XGFChunkDependencyKind";

/** @internal */
export interface XGFMissingDependency {
  kind: XGFChunkDependencyKind;
  id: string;
}
