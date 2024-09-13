
import {XGFData_v1} from "./XGFData_v1";

/**
 * @private
 */
export function unpackXGF(arrayBuffer: ArrayBuffer): XGFData_v1 {

    const requiresSwapFromLittleEndian = (function() {
        const buffer = new ArrayBuffer(2);
        new Uint16Array(buffer)[0] = 1;
        return new Uint8Array(buffer)[0] !== 1;
    })();

    const nextArray = (function() {
        let i = 0;
        const dataView = new DataView(arrayBuffer);
        return function(type) {
            const idx = 1 + 2 * i++; // `1' for the version nr
            const byteOffset = dataView.getUint32(idx       * 4, true);
            const byteLength = dataView.getUint32((idx + 1) * 4, true);

            const BPE = type.BYTES_PER_ELEMENT;
            if (requiresSwapFromLittleEndian && (BPE > 1)) {
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

            return new type(arrayBuffer, byteOffset, byteLength / BPE);
        };
    })();

    const nextObject = (function() {
        const decoder = new TextDecoder();
        return () => JSON.parse(decoder.decode(nextArray(Uint8Array)));
    })();

    // @ts-ignore
    return <XGFData_v1>{
        positions: nextArray(Uint16Array),
        colors: nextArray(Uint8Array),
        indices: nextArray(Uint32Array),
        edgeIndices: nextArray(Uint32Array),
        aabbs: nextArray(Float32Array),
        eachGeometryPositionsBase: nextArray(Uint32Array),
        eachGeometryColorsBase: nextArray(Uint32Array),
        eachGeometryIndicesBase: nextArray(Uint32Array),
        eachGeometryEdgeIndicesBase: nextArray(Uint32Array),
        eachGeometryPrimitiveType: nextArray(Uint8Array),
        eachGeometryAABBBase: nextArray(Uint32Array),
        matrices: nextArray(Float64Array),
        eachMeshGeometriesBase: nextArray(Uint32Array),
        eachMeshMatricesBase: nextArray(Uint32Array),
        eachMeshMaterialAttributes: nextArray(Uint8Array),
        eachObjectId: nextObject(),
        eachObjectMeshesBase: nextArray(Uint32Array)
    };
}
