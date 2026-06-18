import type {XKTData_v12} from "./XKTData_v12";

/**
 * Unpack an XKT v12 binary into the {@link XKTData_v12} payload.
 *
 * The container is an offset table: word 0 is the version, then interleaved
 * (byteOffset, byteLength) `Uint32` pairs, one per array, addressing typed-array
 * views directly into the buffer. Arrays are little-endian and byte-swapped on
 * big-endian hosts. The positional read order MUST match the writer exactly.
 *
 * @private
 */
export function unpackXKT(arrayBuffer: ArrayBuffer): XKTData_v12 {

  const requiresSwapFromLittleEndian = (function () {
    const b = new ArrayBuffer(2);
    new Uint16Array(b)[0] = 1;
    return new Uint8Array(b)[0] !== 1;
  })();

  const nextArray = (function () {
    let i = 0;
    const dataView = new DataView(arrayBuffer);
    return function <T>(type: any): T {
      const idx = 1 + 2 * i++; // word 0 is the version
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

  const nextObject = (function () {
    const decoder = new TextDecoder();
    return () => JSON.parse(decoder.decode(nextArray<Uint8Array>(Uint8Array)));
  })();

  return {
    metadata:                       nextObject(),
    textureData:                    nextArray<Uint8Array>(Uint8Array),
    eachTextureDataPortion:         nextArray<Uint32Array>(Uint32Array),
    eachTextureAttributes:          nextArray<Uint16Array>(Uint16Array),
    positions:                      nextArray<Uint16Array>(Uint16Array),
    normals:                        nextArray<Int8Array>(Int8Array),
    colors:                         nextArray<Uint8Array>(Uint8Array),
    uvs:                            nextArray<Float32Array>(Float32Array),
    indices:                        nextArray<Uint32Array>(Uint32Array),
    edgeIndices:                    nextArray<Uint32Array>(Uint32Array),
    eachTextureSetTextures:         nextArray<Int32Array>(Int32Array),
    matrices:                       nextArray<Float32Array>(Float32Array),
    reusedGeometriesDecodeMatrix:   nextArray<Float32Array>(Float32Array),
    eachGeometryPrimitiveType:      nextArray<Uint8Array>(Uint8Array),
    eachGeometryAxisLabel:          nextObject(),
    eachGeometryPositionsPortion:   nextArray<Uint32Array>(Uint32Array),
    eachGeometryNormalsPortion:     nextArray<Uint32Array>(Uint32Array),
    eachGeometryColorsPortion:      nextArray<Uint32Array>(Uint32Array),
    eachGeometryUVsPortion:         nextArray<Uint32Array>(Uint32Array),
    eachGeometryIndicesPortion:     nextArray<Uint32Array>(Uint32Array),
    eachGeometryEdgeIndicesPortion: nextArray<Uint32Array>(Uint32Array),
    eachMeshGeometriesPortion:      nextArray<Uint32Array>(Uint32Array),
    eachMeshMatricesPortion:        nextArray<Uint32Array>(Uint32Array),
    eachMeshTextureSet:             nextArray<Int32Array>(Int32Array),
    eachMeshMaterialAttributes:     nextArray<Uint8Array>(Uint8Array),
    eachEntityId:                   nextObject(),
    eachEntityMeshesPortion:        nextArray<Uint32Array>(Uint32Array),
    eachTileAABB:                   nextArray<Float64Array>(Float64Array),
    eachTileEntitiesPortion:        nextArray<Uint32Array>(Uint32Array),
  };
}
