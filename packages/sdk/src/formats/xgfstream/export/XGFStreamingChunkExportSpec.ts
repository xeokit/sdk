import type {XGFChunkDependency} from "../chunk/XGFChunkDependency";

/** @internal */
export interface XGFStreamingChunkExportSpec {
  id: string;
  uri: string;
  objectIds: string[];
  assetLibraryIds?: string[];
  dependencies?: XGFChunkDependency[];
  priority?: number;
  lod?: number | string;
}
