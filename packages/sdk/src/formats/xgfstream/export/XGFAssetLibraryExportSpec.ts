/** @internal */
export interface XGFAssetLibraryExportSpec {
  id: string;
  uri: string;
  objectIds?: string[];
  geometryIds?: string[];
  materialIds?: string[];
  textureIds?: string[];
  priority?: number;
  lod?: number | string;
}
