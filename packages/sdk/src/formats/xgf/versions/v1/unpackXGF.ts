import type {XGFData_v1} from "./XGFData_v1";

/**
 * Unpack the v3 binary file into the {@link XGFData_v1} payload. The
 * positional read order MUST match `packXGF` exactly.
 *
 * @private
 */
export function unpackXGF(arrayBuffer: ArrayBuffer): XGFData_v1 {

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

  const nextObject = (function () {
    const decoder = new TextDecoder();
    return () => JSON.parse(decoder.decode(nextArray<Uint8Array>(Uint8Array)));
  })();

  return {
    positions:                   nextArray<Uint16Array>(Uint16Array),
    colors:                      nextArray<Uint8Array>(Uint8Array),
    indices:                     nextArray<Uint32Array>(Uint32Array),
    edgeIndices:                 nextArray<Uint32Array>(Uint32Array),
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
    eachTextureId:               nextObject(),
    eachMaterialPBR:             nextArray<Uint8Array>(Uint8Array),
    eachMaterialColor:           nextArray<Float32Array>(Float32Array),
    eachMaterialTextures:        nextArray<Int32Array>(Int32Array),
    eachMaterialId:              nextObject(),
    eachMaterialTriplanarScale:  nextArray<Float32Array>(Float32Array),
    eachMeshGeometriesBase:      nextArray<Uint32Array>(Uint32Array),
    eachMeshMatricesBase:        nextArray<Uint32Array>(Uint32Array),
    eachMeshMaterialAttributes:  nextArray<Uint8Array>(Uint8Array),
    eachMeshMaterial:            nextArray<Int32Array>(Int32Array),
    eachObjectId:                nextObject(),
    eachObjectMeshesBase:        nextArray<Uint32Array>(Uint32Array)
  };
}
