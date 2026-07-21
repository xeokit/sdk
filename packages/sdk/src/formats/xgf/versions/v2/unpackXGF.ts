import type {XGFData_v2} from "./XGFData_v2";

/**
 * Unpack the v2 binary file into the {@link XGFData_v2} payload. The
 * positional read order MUST match `packXGF` exactly.
 *
 * @private
 */
export function unpackXGF(arrayBuffer: ArrayBuffer): XGFData_v2 {

  const requiresSwapFromLittleEndian = (function () {
    const b = new ArrayBuffer(2);
    new Uint16Array(b)[0] = 1;
    return new Uint8Array(b)[0] !== 1;
  })();

  const nextArray = (function () {
    let i = 0;
    const dataView = new DataView(arrayBuffer);
    return function <T>(type: any): T {
      const idx = 1 + 2 * i++;
      const byteOffset = dataView.getUint32(idx * 4, true);
      const byteLength = dataView.getUint32((idx + 1) * 4, true);
      const BPE = type.BYTES_PER_ELEMENT;
      if (requiresSwapFromLittleEndian && BPE > 1) {
        const subarray = new Uint8Array(arrayBuffer, byteOffset, byteLength);
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
      return new type(arrayBuffer, byteOffset, byteLength / BPE) as T;
    };
  })();

  const nextStringRefs = (function () {
    const decoder = new TextDecoder();
    return () => {
      const bytes = nextArray<Uint8Array>(Uint8Array);
      if (bytes.byteLength === 0) {
        return [];
      }
      if (bytes[0] === 91 || bytes[0] === 123) {
        try {
          const values = JSON.parse(decoder.decode(bytes));
          if (Array.isArray(values)) {
            return values;
          }
        } catch (_error) {
          // A binary string table can naturally begin with "[" or "{" when
          // numStrings is 91 or 123. Fall through to the binary decoder.
        }
      }
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const numStrings = view.getUint32(0, true);
      const numValues = view.getUint32(4, true);
      const stringBytesLength = view.getUint32(8, true);
      const offsetsByteOffset = 12;
      const indicesByteOffset = offsetsByteOffset + ((numStrings + 1) * 4);
      const stringBytesOffset = indicesByteOffset + (numValues * 4);
      const strings: string[] = [];
      for (let i = 0; i < numStrings; i++) {
        const start = view.getUint32(offsetsByteOffset + i * 4, true);
        const end = view.getUint32(offsetsByteOffset + (i + 1) * 4, true);
        strings.push(decoder.decode(bytes.subarray(stringBytesOffset + start, stringBytesOffset + end)));
      }
      const values = new Array<string>(numValues);
      for (let i = 0; i < numValues; i++) {
        const index = view.getUint32(indicesByteOffset + i * 4, true);
        values[i] = strings[index] || "";
      }
      if (stringBytesLength === 0 && numStrings > 0) {
        return values;
      }
      return values;
    };
  })();

  const nextIndexArray = (indexSize: Uint8Array<any>) =>
    indexSize[0] === 2
      ? nextArray<Uint16Array>(Uint16Array)
      : nextArray<Uint32Array>(Uint32Array);

  const positions = nextArray<Uint16Array>(Uint16Array);
  const colors = nextArray<Uint8Array>(Uint8Array);
  const indexSize = nextArray<Uint8Array>(Uint8Array);
  const indices = nextIndexArray(indexSize);
  const edgeIndexSize = nextArray<Uint8Array>(Uint8Array);
  const edgeIndices = nextIndexArray(edgeIndexSize);

  return {
    positions,
    colors,
    indexSize,
    indices,
    edgeIndexSize,
    edgeIndices,
    aabbs:                       nextArray<Float32Array>(Float32Array),
    normals:                     nextArray<Uint16Array>(Uint16Array),
    uvs:                         nextArray<Float32Array>(Float32Array),
    scales:                      nextArray<Float32Array>(Float32Array),
    rotations:                   nextArray<Uint8Array>(Uint8Array),
    eachGeometryPositionsBase:   nextArray<Uint32Array>(Uint32Array),
    eachGeometryColorsBase:      nextArray<Uint32Array>(Uint32Array),
    eachGeometryIndicesBase:     nextArray<Uint32Array>(Uint32Array),
    eachGeometryEdgeIndicesBase: nextArray<Uint32Array>(Uint32Array),
    eachGeometryNormalsBase:     nextArray<Uint32Array>(Uint32Array),
    eachGeometryUVsBase:         nextArray<Uint32Array>(Uint32Array),
    eachGeometryScalesBase:      nextArray<Uint32Array>(Uint32Array),
    eachGeometryRotationsBase:   nextArray<Uint32Array>(Uint32Array),
    eachGeometryPrimitiveType:   nextArray<Uint8Array>(Uint8Array),
    eachGeometryAABBBase:        nextArray<Uint32Array>(Uint32Array),
    matrices:                    nextArray<Float64Array>(Float64Array),
    textureData:                 nextArray<Uint8Array>(Uint8Array),
    eachTextureDataBase:         nextArray<Uint32Array>(Uint32Array),
    eachTextureMediaType:        nextArray<Uint8Array>(Uint8Array),
    eachTextureWidth:            nextArray<Uint16Array>(Uint16Array),
    eachTextureHeight:           nextArray<Uint16Array>(Uint16Array),
    eachTextureSampler:          nextArray<Uint8Array>(Uint8Array),
    eachTextureEncoding:         nextArray<Uint16Array>(Uint16Array),
    eachTextureId:               nextStringRefs(),
    eachMaterialPBR:             nextArray<Uint8Array>(Uint8Array),
    eachMaterialColor:           nextArray<Float32Array>(Float32Array),
    eachMaterialTextures:        nextArray<Int32Array>(Int32Array),
    eachMaterialId:              nextStringRefs(),
    eachMaterialTriplanarScale:  nextArray<Float32Array>(Float32Array),
    eachMeshGeometriesBase:      nextArray<Uint32Array>(Uint32Array),
    eachMeshMatricesBase:        nextArray<Uint32Array>(Uint32Array),
    eachMeshMaterialAttributes:  nextArray<Uint8Array>(Uint8Array),
    eachMeshMaterial:            nextArray<Int32Array>(Int32Array),
    eachObjectId:                nextStringRefs(),
    eachObjectMeshesBase:        nextArray<Uint32Array>(Uint32Array),
    eachGeometryId:              nextStringRefs(),
    eachMeshGeometryId:          nextStringRefs(),
    eachMeshMaterialId:          nextStringRefs(),
    eachTransformId:             nextStringRefs(),
    eachTransformParentId:       nextStringRefs(),
    eachTransformMatricesBase:   nextArray<Uint32Array>(Uint32Array),
    eachMeshParentTransformId:   nextStringRefs()
  };
}
