import type {ModelParseParams} from "../../../../ModelParseParams";
import {splitElements} from "../shared/splitElements";
import {inflateBuffer, inflateString} from "../shared/inflateElements";
import {buildTiledSceneModel} from "../shared/buildTiledSceneModel";
import type {TiledXKTData} from "../shared/TiledXKTData";

/**
 * Parse an XKT v10 binary into a SceneModel and DataModel. v10 adds embedded
 * textures and UVs; like the v12 loader, textures and UVs are not consumed —
 * geometry, materials and metadata are.
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
    eachGeometryPositionsPortion: new Uint32Array(inflateBuffer(e[14])),
    eachGeometryColorsPortion: new Uint32Array(inflateBuffer(e[16])),
    eachGeometryIndicesPortion: new Uint32Array(inflateBuffer(e[18])),
    eachMeshGeometriesPortion: new Uint32Array(inflateBuffer(e[20])),
    eachMeshMatricesPortion: new Uint32Array(inflateBuffer(e[21])),
    eachMeshMaterialAttributes: new Uint8Array(inflateBuffer(e[23])),
    eachEntityId: JSON.parse(inflateString(e[24])),
    eachEntityMeshesPortion: new Uint32Array(inflateBuffer(e[25])),
    eachTileAABB: new Float64Array(inflateBuffer(e[26])),
    eachTileEntitiesPortion: new Uint32Array(inflateBuffer(e[27])),
  };

  await buildTiledSceneModel({xktData, sceneModel, dataModel, options: options || {}});
}
