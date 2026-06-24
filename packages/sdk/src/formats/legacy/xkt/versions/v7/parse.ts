import type {ModelParseParams} from "../../../../ModelParseParams";
import {splitElements} from "../shared/splitElements";
import {inflateBuffer, inflateString} from "../shared/inflateElements";
import {buildTiledSceneModel} from "../shared/buildTiledSceneModel";
import type {TiledXKTData} from "../shared/TiledXKTData";

/**
 * Parse an XKT v7 binary (deflated, tiled, no embedded metadata or textures)
 * into a SceneModel. Normals, edges and the colour-portion table for non-point
 * geometry are stored but unused — the renderer derives flat normals and edges.
 *
 * @private
 */
export async function parse(params: ModelParseParams, options?: any): Promise<void> {
  const {fileData, sceneModel, dataModel} = params;
  const e = splitElements(fileData);

  const xktData: TiledXKTData = {
    positions: new Uint16Array(inflateBuffer(e[0])),
    colors: new Uint8Array(inflateBuffer(e[2])),
    colorComponents: 3,
    indices: new Uint32Array(inflateBuffer(e[3])),
    matrices: new Float32Array(inflateBuffer(e[5])),
    reusedGeometriesDecodeMatrix: new Float32Array(inflateBuffer(e[6])),
    eachGeometryPrimitiveType: new Uint8Array(inflateBuffer(e[7])),
    eachGeometryPositionsPortion: new Uint32Array(inflateBuffer(e[8])),
    eachGeometryColorsPortion: new Uint32Array(inflateBuffer(e[10])),
    eachGeometryIndicesPortion: new Uint32Array(inflateBuffer(e[11])),
    eachMeshGeometriesPortion: new Uint32Array(inflateBuffer(e[13])),
    eachMeshMatricesPortion: new Uint32Array(inflateBuffer(e[14])),
    eachMeshMaterialAttributes: new Uint8Array(inflateBuffer(e[15])),
    eachEntityId: JSON.parse(inflateString(e[16])),
    eachEntityMeshesPortion: new Uint32Array(inflateBuffer(e[17])),
    eachTileAABB: new Float64Array(inflateBuffer(e[18])),
    eachTileEntitiesPortion: new Uint32Array(inflateBuffer(e[19])),
  };

  await buildTiledSceneModel({xktData, sceneModel, dataModel, options: options || {}});
}
