import type {XGFChunkDependency} from "../chunk/XGFChunkDependency";
import type {SceneRepSetParams} from "../../../model/scene";

/** @internal */
export interface XGFStreamingChunkExportSpec {
  id: string;
  uri: string;
  objectIds: string[];
  assetLibraryIds?: string[];
  dependencies?: XGFChunkDependency[];
  priority?: number;
  lod?: number | string;
  layerId?: string;
  repSets?: SceneRepSetParams[];
}
