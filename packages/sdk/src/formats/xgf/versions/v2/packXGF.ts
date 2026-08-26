import {XGF_INFO} from "./XGF_INFO";
import type {XGFData_v2} from "./XGFData_v2";

const stringRefs2Array = (function () {
  const encoder = new TextEncoder();
  return (values: string[]) => {
    if (!values || values.length === 0) {
      return new Uint8Array(0);
    }
    const json = encoder.encode(JSON.stringify(values));
    const stringIndex = new Map<string, number>();
    const strings: string[] = [];
    const valueIndices = new Uint32Array(values.length);
    for (let i = 0; i < values.length; i++) {
      const value = values[i] || "";
      let index = stringIndex.get(value);
      if (index === undefined) {
        index = strings.length;
        stringIndex.set(value, index);
        strings.push(value);
      }
      valueIndices[i] = index;
    }

    const encodedStrings = strings.map((value) => encoder.encode(value));
    const stringOffsets = new Uint32Array(strings.length + 1);
    let stringBytesLength = 0;
    for (let i = 0; i < encodedStrings.length; i++) {
      stringOffsets[i] = stringBytesLength;
      stringBytesLength += encodedStrings[i].byteLength;
    }
    stringOffsets[strings.length] = stringBytesLength;

    const headerBytes = 12;
    const offsetsBytes = stringOffsets.byteLength;
    const indicesBytes = valueIndices.byteLength;
    const data = new Uint8Array(headerBytes + offsetsBytes + indicesBytes + stringBytesLength);
    const view = new DataView(data.buffer);
    view.setUint32(0, strings.length, true);
    view.setUint32(4, values.length, true);
    view.setUint32(8, stringBytesLength, true);
    data.set(new Uint8Array(stringOffsets.buffer), headerBytes);
    data.set(new Uint8Array(valueIndices.buffer), headerBytes + offsetsBytes);
    let cursor = headerBytes + offsetsBytes + indicesBytes;
    for (const encoded of encodedStrings) {
      data.set(encoded, cursor);
      cursor += encoded.byteLength;
    }
    return data.byteLength < json.byteLength ? data : json;
  };
})();

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
 * Pack the XGF v2 payload into the binary file format. The order of entries
 * MUST match `unpackXGF`.
 *
 * @private
 */
export function packXGF(xgfData: XGFData_v2): ArrayBuffer {
  return toArrayBuffer([
    xgfData.positions,
    xgfData.colors,
    xgfData.indexSize,
    xgfData.indices,
    xgfData.edgeIndexSize,
    xgfData.edgeIndices,
    xgfData.aabbs,
    xgfData.normals,
    xgfData.uvs,
    xgfData.scales,
    xgfData.rotations,
    xgfData.eachGeometryPositionsBase,
    xgfData.eachGeometryColorsBase,
    xgfData.eachGeometryIndicesBase,
    xgfData.eachGeometryEdgeIndicesBase,
    xgfData.eachGeometryNormalsBase,
    xgfData.eachGeometryUVsBase,
    xgfData.eachGeometryScalesBase,
    xgfData.eachGeometryRotationsBase,
    xgfData.eachGeometryPrimitiveType,
    xgfData.eachGeometryAABBBase,
    xgfData.matrices,
    xgfData.textureData,
    xgfData.eachTextureDataBase,
    xgfData.eachTextureMediaType,
    xgfData.eachTextureWidth,
    xgfData.eachTextureHeight,
    xgfData.eachTextureSampler,
    xgfData.eachTextureEncoding,
    stringRefs2Array(xgfData.eachTextureId),
    xgfData.eachMaterialPBR,
    xgfData.eachMaterialColor,
    xgfData.eachMaterialTextures,
    stringRefs2Array(xgfData.eachMaterialId),
    xgfData.eachMaterialTriplanarScale,
    xgfData.eachMeshGeometriesBase,
    xgfData.eachMeshMatricesBase,
    xgfData.eachMeshMaterialAttributes,
    xgfData.eachMeshMaterial,
    stringRefs2Array(xgfData.eachObjectId),
    xgfData.eachObjectMeshesBase,
    stringRefs2Array(xgfData.eachGeometryId),
    stringRefs2Array(xgfData.eachMeshGeometryId),
    stringRefs2Array(xgfData.eachMeshMaterialId),
    stringRefs2Array(xgfData.eachTransformId),
    stringRefs2Array(xgfData.eachTransformParentId),
    xgfData.eachTransformMatricesBase,
    stringRefs2Array(xgfData.eachMeshParentTransformId),
    stringRefs2Array(xgfData.eachRepSetId),
    stringRefs2Array(xgfData.eachRepSetDefaultRepId),
    xgfData.eachRepSetSelectionStrategy,
    xgfData.eachRepSetHysteresisPixels,
    xgfData.eachRepSetRepsBase,
    stringRefs2Array(xgfData.eachRepId),
    xgfData.eachRepRangeMinPixels,
    xgfData.eachRepRangeMaxPixels,
    xgfData.eachRepObjectIdsBase,
    stringRefs2Array(xgfData.repObjectIds)
  ]);
}
