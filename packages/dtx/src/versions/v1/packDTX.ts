import type {DTXDataDeflated} from "./DTXDataDeflated";
import {DTX_INFO} from "./DTX_INFO";

/**
 * @private
 */
export function packDTX(deflatedData: DTXDataDeflated): ArrayBuffer {
    return toArrayBuffer(<Buffer[]>[
        deflatedData.positions,
        deflatedData.colors,
        deflatedData.indices,
        deflatedData.edgeIndices,
        deflatedData.aabbs,
        deflatedData.eachGeometryPositionsBase,
        deflatedData.eachGeometryColorsBase,
        deflatedData.eachGeometryIndicesBase,
        deflatedData.eachGeometryEdgeIndicesBase,
        deflatedData.eachGeometryPrimitiveType,
        deflatedData.eachGeometryAABBBase,
        deflatedData.matrices,
        deflatedData.eachMeshGeometriesBase,
        deflatedData.eachMeshMatricesBase,
        deflatedData.eachMeshMaterialAttributes,
        deflatedData.eachObjectId,
        deflatedData.eachObjectMeshesBase
    ]);
}

function toArrayBuffer(elements: Buffer[]): ArrayBuffer {
    const indexData = new Uint32Array(elements.length + 2);
    indexData[0] = DTX_INFO.dtxVersion;
    indexData [1] = elements.length;  // Stored Data 1.1: number of stored elements
    let dataLen = 0;    // Stored Data 1.2: length of stored elements
    for (let i = 0, len = elements.length; i < len; i++) {
        const element = elements[i];
        const elementsize = element.length;
        indexData[i + 2] = elementsize;
        dataLen += elementsize;
    }
    const indexBuf = new Uint8Array(indexData.buffer);
    const dataArray = new Uint8Array(indexBuf.length + dataLen);
    dataArray.set(indexBuf);
    let offset = indexBuf.length;
    for (let i = 0, len = elements.length; i < len; i++) {     // Stored Data 2: the elements themselves
        const element = elements[i];
        dataArray.set(element, offset);
        offset += element.length;
    }
    return dataArray.buffer;
}
