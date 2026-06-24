import type {ModelParseParams} from "../../../../ModelParseParams";
import {splitElements} from "../shared/splitElements";
import {inflateBuffer, inflateString} from "../shared/inflateElements";
import {buildTiledSceneModel} from "../shared/buildTiledSceneModel";
import type {TiledXKTData} from "../shared/TiledXKTData";

/**
 * Parse an XKT v8 binary into a SceneModel and DataModel.
 *
 * v8 is the first version to embed metadata, stored as parallel arrays (type,
 * name and parent indices keyed by metaobject) rather than the JSON document of
 * later versions. Entities reference their metaobject by index, and an entity's
 * id is that metaobject's id.
 *
 * @private
 */
export async function parse(params: ModelParseParams, options?: any): Promise<void> {
  const {fileData, sceneModel, dataModel} = params;
  const e = splitElements(fileData);

  const types: string[] = JSON.parse(inflateString(e[0]));
  const eachMetaObjectId: string[] = JSON.parse(inflateString(e[1]));
  const eachMetaObjectType = new Uint32Array(inflateBuffer(e[2]));
  const eachMetaObjectName: string[] = JSON.parse(inflateString(e[3]));
  const eachMetaObjectParent = new Uint32Array(inflateBuffer(e[4]));
  const eachEntityMetaObject = new Uint32Array(inflateBuffer(e[21]));

  const metadata = {
    metaObjects: eachMetaObjectId.map((id, i) => ({
      id,
      type: types[eachMetaObjectType[i]] || "Default",
      name: eachMetaObjectName[i],
      parent: eachMetaObjectParent[i] !== i ? eachMetaObjectId[eachMetaObjectParent[i]] : null,
    })),
    propertySets: [],
  };
  const eachEntityId = Array.from(eachEntityMetaObject, (metaObjectIndex) => eachMetaObjectId[metaObjectIndex]);

  const xktData: TiledXKTData = {
    positions: new Uint16Array(inflateBuffer(e[5])),
    colors: new Uint8Array(inflateBuffer(e[7])),
    colorComponents: 3,
    indices: new Uint32Array(inflateBuffer(e[8])),
    matrices: new Float32Array(inflateBuffer(e[10])),
    reusedGeometriesDecodeMatrix: new Float32Array(inflateBuffer(e[11])),
    eachGeometryPrimitiveType: new Uint8Array(inflateBuffer(e[12])),
    eachGeometryPositionsPortion: new Uint32Array(inflateBuffer(e[13])),
    eachGeometryColorsPortion: new Uint32Array(inflateBuffer(e[15])),
    eachGeometryIndicesPortion: new Uint32Array(inflateBuffer(e[16])),
    eachMeshGeometriesPortion: new Uint32Array(inflateBuffer(e[18])),
    eachMeshMatricesPortion: new Uint32Array(inflateBuffer(e[19])),
    eachMeshMaterialAttributes: new Uint8Array(inflateBuffer(e[20])),
    eachEntityId,
    eachEntityMeshesPortion: new Uint32Array(inflateBuffer(e[22])),
    eachTileAABB: new Float64Array(inflateBuffer(e[23])),
    eachTileEntitiesPortion: new Uint32Array(inflateBuffer(e[24])),
    metadata,
  };

  await buildTiledSceneModel({xktData, sceneModel, dataModel, options: options || {}});
}
