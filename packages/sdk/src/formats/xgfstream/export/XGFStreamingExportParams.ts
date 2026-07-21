import type {SceneModel} from "../../../model/scene";
import type {XGFAssetLibraryExportSpec} from "./XGFAssetLibraryExportSpec";
import type {XGFStreamingChunkExportSpec} from "./XGFStreamingChunkExportSpec";

/** @internal */
export interface XGFStreamingExportParams {
  sceneModel: SceneModel;
  assetLibraries: XGFAssetLibraryExportSpec[];
  chunks: XGFStreamingChunkExportSpec[];
  indexUri?: string;
  runtimeIndexUri?: string;
}
