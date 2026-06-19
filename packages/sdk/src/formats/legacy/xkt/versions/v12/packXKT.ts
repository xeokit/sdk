import {XKT_INFO} from "./XKT_INFO";
import type {XKTData_v12} from "./XKTData_v12";

const object2Array = (function () {
  const encoder = new TextEncoder();
  return (obj: any) => encoder.encode(JSON.stringify(obj));
})();

/**
 * Pack a heterogeneous list of typed arrays + JSON blobs into one ArrayBuffer
 * with a per-entry (offset, length) table — the uncompressed XKT v12 container.
 *
 * Layout (matching `xeokit-convert`'s uncompressed writer and {@link unpackXKT}):
 *   - u32 [0]            version tag ({@link XKT_INFO.xktVersion})
 *   - u32 [1, 3, 5, …]   per-entry byte offset
 *   - u32 [2, 4, 6, …]   per-entry byte length
 *   - bytes              each entry's payload, padded to its element alignment
 */
function toArrayBuffer(arrays: any[]): ArrayBuffer {
  const arraysCnt = arrays.length;
  const dataView = new DataView(new ArrayBuffer((1 + 2 * arraysCnt) * 4));

  dataView.setUint32(0, XKT_INFO.xktVersion, true);

  let byteOffset = dataView.byteLength;
  const offsets: number[] = [];

  for (let i = 0; i < arraysCnt; i++) {
    const arr = arrays[i];
    const BPE = arr.BYTES_PER_ELEMENT;
    byteOffset = Math.ceil(byteOffset / BPE) * BPE; // align so a typed-array view is valid
    const idx = 1 + 2 * i;
    dataView.setUint32(idx * 4, byteOffset, true);
    dataView.setUint32((idx + 1) * 4, arr.byteLength, true);
    offsets.push(byteOffset);
    byteOffset += arr.byteLength;
  }

  const dataArray = new Uint8Array(byteOffset);
  dataArray.set(new Uint8Array(dataView.buffer), 0);

  const requiresSwapToLittleEndian = (function () {
    const b = new ArrayBuffer(2);
    new Uint16Array(b)[0] = 1;
    return new Uint8Array(b)[0] !== 1;
  })();

  for (let i = 0; i < arraysCnt; i++) {
    const arr = arrays[i];
    const subarray = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    const BPE = arr.BYTES_PER_ELEMENT;
    if (requiresSwapToLittleEndian && BPE > 1) {
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
    dataArray.set(subarray, offsets[i]);
  }

  return dataArray.buffer;
}

/**
 * Pack the XKT v12 payload into the binary file. The entry order MUST match
 * {@link unpackXKT} exactly.
 *
 * @private
 */
export function packXKT(xktData: XKTData_v12): ArrayBuffer {
  return toArrayBuffer([
    object2Array(xktData.metadata),
    xktData.textureData,
    xktData.eachTextureDataPortion,
    xktData.eachTextureAttributes,
    xktData.positions,
    xktData.normals,
    xktData.colors,
    xktData.uvs,
    xktData.indices,
    xktData.edgeIndices,
    xktData.eachTextureSetTextures,
    xktData.matrices,
    xktData.reusedGeometriesDecodeMatrix,
    xktData.eachGeometryPrimitiveType,
    object2Array(xktData.eachGeometryAxisLabel),
    xktData.eachGeometryPositionsPortion,
    xktData.eachGeometryNormalsPortion,
    xktData.eachGeometryColorsPortion,
    xktData.eachGeometryUVsPortion,
    xktData.eachGeometryIndicesPortion,
    xktData.eachGeometryEdgeIndicesPortion,
    xktData.eachMeshGeometriesPortion,
    xktData.eachMeshMatricesPortion,
    xktData.eachMeshTextureSet,
    xktData.eachMeshMaterialAttributes,
    object2Array(xktData.eachEntityId),
    xktData.eachEntityMeshesPortion,
    xktData.eachTileAABB,
    xktData.eachTileEntitiesPortion,
  ]);
}
