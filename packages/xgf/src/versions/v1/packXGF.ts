
import {XGF_INFO} from "./XGF_INFO";
import {XGFData_v1} from "./XGFData_v1";

const object2Array = (function() {
    const encoder = new TextEncoder();
    return obj => encoder.encode(JSON.stringify(obj));
})();

function toArrayBuffer(arrays: Buffer[]): ArrayBuffer {

    const arraysCnt = arrays.length;
    const dataView = new DataView(new ArrayBuffer((1 + 2 * arraysCnt) * 4));

    dataView.setUint32(0, XGF_INFO.xgfVersion, true);

    let byteOffset = dataView.byteLength;
    const offsets = [ ];

    // Store arrays' offsets and lengths
    for (let i = 0; i < arraysCnt; i++) {
        const arr = arrays[i];
        const BPE = arr.BYTES_PER_ELEMENT;
        // align to BPE, so the arrayBuffer can be used for a typed array
        byteOffset = Math.ceil(byteOffset / BPE) * BPE;
        const byteLength = arr.byteLength;

        const idx = 1 + 2 * i;
        dataView.setUint32(idx       * 4, byteOffset, true);
        dataView.setUint32((idx + 1) * 4, byteLength, true);

        offsets.push(byteOffset);
        byteOffset += byteLength;
    }

    const dataArray = new Uint8Array(byteOffset);
    dataArray.set(new Uint8Array(dataView.buffer), 0);

    const requiresSwapToLittleEndian = (function() {
        const buffer = new ArrayBuffer(2);
        new Uint16Array(buffer)[0] = 1;
        return new Uint8Array(buffer)[0] !== 1;
    })();

    // Store arrays themselves
    for (let i = 0; i < arraysCnt; i++) {
        const arr = arrays[i];
        const subarray = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);

        const BPE = arr.BYTES_PER_ELEMENT;
        if (requiresSwapToLittleEndian && (BPE > 1)) {
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
 * @private
 */
export function packXGF(xgfData: XGFData_v1): ArrayBuffer {
    return toArrayBuffer(<Buffer[]>[
        xgfData.positions,
        xgfData.colors,
        xgfData.indices,
        xgfData.edgeIndices,
        xgfData.aabbs,
        xgfData.eachGeometryPositionsBase,
        xgfData.eachGeometryColorsBase,
        xgfData.eachGeometryIndicesBase,
        xgfData.eachGeometryEdgeIndicesBase,
        xgfData.eachGeometryPrimitiveType,
        xgfData.eachGeometryAABBBase,
        xgfData.matrices,
        xgfData.eachMeshGeometriesBase,
        xgfData.eachMeshMatricesBase,
        xgfData.eachMeshMaterialAttributes,
        object2Array(xgfData.eachObjectId),
        xgfData.eachObjectMeshesBase
    ]);
}

