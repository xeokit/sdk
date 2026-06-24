import type {ModelParseParams} from "../../../../ModelParseParams";
import {splitElements} from "../shared/splitElements";
import {inflateBuffer, inflateString} from "../shared/inflateElements";
import {buildTiledSceneModel} from "../shared/buildTiledSceneModel";
import type {TiledXKTData} from "../shared/TiledXKTData";

/**
 * Parse a *compressed* XKT v12 binary into a SceneModel and DataModel.
 *
 * A v12 file is compressed when the high bit of its header word is set; it then
 * uses the deflated, length-prefixed container (the same as v7-v10) rather than
 * the uncompressed offset table that {@link parse} handles. The element layout
 * is v11's plus a per-geometry axis-label element (index 14), which — like
 * textures, UVs, normals and edges — is read past but not consumed.
 *
 * @private
 */
export async function parse(params: ModelParseParams, options?: any): Promise<void> {
  const {fileData, sceneModel, dataModel} = params;
  const e = splitElements(fileData);

  const xktData: TiledXKTData = {
    metadata: JSON.parse(inflateString(e[0])),
    positions: new Uint16Array(inflateBuffer(e[4])),
    colors: new Uint8Array(inflateBuffer(e[6])),
    colorComponents: 4,
    indices: new Uint32Array(inflateBuffer(e[8])),
    matrices: new Float32Array(inflateBuffer(e[11])),
    reusedGeometriesDecodeMatrix: new Float32Array(inflateBuffer(e[12])),
    eachGeometryPrimitiveType: new Uint8Array(inflateBuffer(e[13])),
    eachGeometryPositionsPortion: new Uint32Array(inflateBuffer(e[15])),
    eachGeometryColorsPortion: new Uint32Array(inflateBuffer(e[17])),
    eachGeometryIndicesPortion: new Uint32Array(inflateBuffer(e[19])),
    eachMeshGeometriesPortion: new Uint32Array(inflateBuffer(e[21])),
    eachMeshMatricesPortion: new Uint32Array(inflateBuffer(e[22])),
    eachMeshMaterialAttributes: new Uint8Array(inflateBuffer(e[24])),
    eachEntityId: JSON.parse(inflateString(e[25])),
    eachEntityMeshesPortion: new Uint32Array(inflateBuffer(e[26])),
    eachTileAABB: new Float64Array(inflateBuffer(e[27])),
    eachTileEntitiesPortion: new Uint32Array(inflateBuffer(e[28])),
  };

  await buildTiledSceneModel({xktData, sceneModel, dataModel, options: options || {}});
}
