import {XGF_INFO} from "./XGF_INFO";
import type {XGFData_v2} from "./XGFData_v2";

const object2Array = (function () {
  const encoder = new TextEncoder();
  return (obj: any) => encoder.encode(JSON.stringify(obj));
})();

/**
 * Packs a heterogeneous list of typed-arrays + JSON-encoded blobs into
 * one ArrayBuffer with a per-entry (offset, length) table.
 *
 * Layout:
 *   - u32 [0]               version tag ({@link XGF_INFO.xgfVersion})
 *   - u32 [1, 3, 5, ...]    per-entry byte offset
 *   - u32 [2, 4, 6, ...]    per-entry byte length
 *   - bytes                 each entry's payload, padded to its
 *                           BYTES_PER_ELEMENT alignment
 *
 * The reader ({@link unpackXGF}) walks the same positional list to
 * recover each typed-array view.
 */
function toArrayBuffer(arrays: any[]): ArrayBuffer {
  const arraysCnt = arrays.length;
  const dataView = new DataView(new ArrayBuffer((1 + 2 * arraysCnt) * 4));

  dataView.setUint32(0, XGF_INFO.xgfVersion, true);

  let byteOffset = dataView.byteLength;
  const offsets: number[] = [];

  for (let i = 0; i < arraysCnt; i++) {
    const arr = arrays[i];
    const BPE = arr.BYTES_PER_ELEMENT;
    byteOffset = Math.ceil(byteOffset / BPE) * BPE;
    const byteLength = arr.byteLength;
    const idx = 1 + 2 * i;
    dataView.setUint32(idx * 4, byteOffset, true);
    dataView.setUint32((idx + 1) * 4, byteLength, true);
    offsets.push(byteOffset);
    byteOffset += byteLength;
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
 * Pack the XGF v2 payload into the binary file format. The order of
 * entries below MUST match {@link unpackXGF}.
 *
 * @private
 */
export function packXGF(xgfData: XGFData_v2): ArrayBuffer {
  return toArrayBuffer([
    xgfData.positions,
    xgfData.colors,
    xgfData.indices,
    xgfData.edgeIndices,
    xgfData.aabbs,
    xgfData.normals,
    xgfData.uvs,
    xgfData.eachGeometryPositionsBase,
    xgfData.eachGeometryColorsBase,
    xgfData.eachGeometryIndicesBase,
    xgfData.eachGeometryEdgeIndicesBase,
    xgfData.eachGeometryNormalsBase,
    xgfData.eachGeometryUVsBase,
    xgfData.eachGeometryPrimitiveType,
    xgfData.eachGeometryAABBBase,
    xgfData.matrices,
    xgfData.textureData,
    xgfData.eachTextureDataBase,
    xgfData.eachTextureMediaType,
    xgfData.eachTextureWidth,
    xgfData.eachTextureHeight,
    xgfData.eachTextureSampler,
    object2Array(xgfData.eachTextureId),
    xgfData.eachMaterialPBR,
    xgfData.eachMaterialTextures,
    object2Array(xgfData.eachMaterialId),
    xgfData.eachMeshGeometriesBase,
    xgfData.eachMeshMatricesBase,
    xgfData.eachMeshMaterialAttributes,
    xgfData.eachMeshMaterial,
    object2Array(xgfData.eachObjectId),
    xgfData.eachObjectMeshesBase
  ]);
}
