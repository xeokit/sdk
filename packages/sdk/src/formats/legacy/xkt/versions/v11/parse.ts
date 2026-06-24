import type {ModelParseParams} from "../../../../ModelParseParams";
import {buildTiledSceneModel} from "../shared/buildTiledSceneModel";
import type {TiledXKTData} from "../shared/TiledXKTData";

/**
 * Parse an XKT v11 binary into a SceneModel and DataModel.
 *
 * v11 shares v12's uncompressed offset-table container (word 0 is the version,
 * then interleaved `(byteOffset, byteLength)` pairs addressing typed-array views
 * into the buffer), and differs only in lacking v12's per-geometry axis-label
 * field. The positional read order MUST match the writer exactly. Textures, UVs,
 * normals and edges are read past but not consumed.
 *
 * @private
 */
export async function parse(params: ModelParseParams, options?: any): Promise<void> {
  const {fileData, sceneModel, dataModel} = params;

  const requiresSwapFromLittleEndian = (function () {
    const b = new ArrayBuffer(2);
    new Uint16Array(b)[0] = 1;
    return new Uint8Array(b)[0] !== 1;
  })();

  const dataView = new DataView(fileData);
  let i = 0;
  const nextArray = <T>(type: any): T => {
    const idx = 1 + 2 * i++; // word 0 is the version
    const byteOffset = dataView.getUint32(idx * 4, true);
    const byteLength = dataView.getUint32((idx + 1) * 4, true);
    const BPE = type.BYTES_PER_ELEMENT;
    if (requiresSwapFromLittleEndian && BPE > 1) {
      const subarray = new Uint8Array(fileData, byteOffset, byteLength);
      const swaps = BPE / 2;
      const cnt = subarray.length / BPE;
      for (let b = 0; b < cnt; b++) {
        const offset = b * BPE;
        for (let j = 0; j < swaps; j++) {
          const i1 = offset + j;
          const i2 = offset - j + BPE - 1;
          const tmp = subarray[i1];
          subarray[i1] = subarray[i2];
          subarray[i2] = tmp;
        }
      }
    }
    return new type(fileData, byteOffset, byteLength / BPE) as T;
  };
  const decoder = new TextDecoder();
  const nextObject = () => JSON.parse(decoder.decode(nextArray<Uint8Array>(Uint8Array)));

  const metadata = nextObject();
  nextArray<Uint8Array>(Uint8Array);    // textureData
  nextArray<Uint32Array>(Uint32Array);  // eachTextureDataPortion
  nextArray<Uint16Array>(Uint16Array);  // eachTextureAttributes
  const positions = nextArray<Uint16Array>(Uint16Array);
  nextArray<Int8Array>(Int8Array);      // normals
  const colors = nextArray<Uint8Array>(Uint8Array);
  nextArray<Float32Array>(Float32Array);// uvs
  const indices = nextArray<Uint32Array>(Uint32Array);
  nextArray<Uint32Array>(Uint32Array);  // edgeIndices
  nextArray<Int32Array>(Int32Array);    // eachTextureSetTextures
  const matrices = nextArray<Float32Array>(Float32Array);
  const reusedGeometriesDecodeMatrix = nextArray<Float32Array>(Float32Array);
  const eachGeometryPrimitiveType = nextArray<Uint8Array>(Uint8Array);
  const eachGeometryPositionsPortion = nextArray<Uint32Array>(Uint32Array);
  nextArray<Uint32Array>(Uint32Array);  // eachGeometryNormalsPortion
  const eachGeometryColorsPortion = nextArray<Uint32Array>(Uint32Array);
  nextArray<Uint32Array>(Uint32Array);  // eachGeometryUVsPortion
  const eachGeometryIndicesPortion = nextArray<Uint32Array>(Uint32Array);
  nextArray<Uint32Array>(Uint32Array);  // eachGeometryEdgeIndicesPortion
  const eachMeshGeometriesPortion = nextArray<Uint32Array>(Uint32Array);
  const eachMeshMatricesPortion = nextArray<Uint32Array>(Uint32Array);
  nextArray<Int32Array>(Int32Array);    // eachMeshTextureSet
  const eachMeshMaterialAttributes = nextArray<Uint8Array>(Uint8Array);
  const eachEntityId = nextObject();
  const eachEntityMeshesPortion = nextArray<Uint32Array>(Uint32Array);
  const eachTileAABB = nextArray<Float64Array>(Float64Array);
  const eachTileEntitiesPortion = nextArray<Uint32Array>(Uint32Array);

  const xktData: TiledXKTData = {
    metadata,
    positions,
    colors,
    colorComponents: 4,
    indices,
    matrices,
    reusedGeometriesDecodeMatrix,
    eachGeometryPrimitiveType,
    eachGeometryPositionsPortion,
    eachGeometryColorsPortion,
    eachGeometryIndicesPortion,
    eachMeshGeometriesPortion,
    eachMeshMatricesPortion,
    eachMeshMaterialAttributes,
    eachEntityId,
    eachEntityMeshesPortion,
    eachTileAABB,
    eachTileEntitiesPortion,
  };

  await buildTiledSceneModel({xktData, sceneModel, dataModel, options: options || {}});
}
