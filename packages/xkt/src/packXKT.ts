import type {XKTDataDeflated} from "./XKTDataDeflated";
import {XKT_INFO} from "./XKT_INFO";

/**
 * @private
 */
export function packXKT(deflatedData: XKTDataDeflated): ArrayBuffer {
    return toArrayBuffer(<Buffer[]>[
        deflatedData.metadata,
        deflatedData.textureData,
        deflatedData.eachTextureDataPortion,
        deflatedData.eachTextureAttributes,
        deflatedData.positions,
        deflatedData.colors,
        deflatedData.uvs,
        deflatedData.indices8Bit,
        deflatedData.indices16Bit,
        deflatedData.indices32Bit,
        deflatedData.edgeIndices8Bit,
        deflatedData.edgeIndices16Bit,
        deflatedData.edgeIndices32Bit,
        deflatedData.eachTextureSetTextures,
        deflatedData.decodeMatrices,
        deflatedData.eachBucketPositionsPortion,
        deflatedData.eachBucketColorsPortion,
        deflatedData.eachBucketUVsPortion,
        deflatedData.eachBucketIndicesPortion,
        deflatedData.eachBucketEdgeIndicesPortion,
        deflatedData.eachBucketIndicesBitness,
        deflatedData.eachGeometryPrimitiveType,
        deflatedData.eachGeometryBucketPortion,
        deflatedData.eachGeometryDecodeMatricesPortion,
        deflatedData.matrices,
        deflatedData.eachMeshGeometriesPortion,
        deflatedData.eachMeshMatricesPortion,
        deflatedData.eachMeshTextureSet,
        deflatedData.eachMeshMaterialAttributes,
        deflatedData.eachGeometryId,
        deflatedData.eachMeshId,
        deflatedData.eachObjectId,
        deflatedData.eachObjectMeshesPortion
    ]);
}

function toArrayBuffer(elements: Buffer[]): ArrayBuffer {
    const indexData = new Uint32Array(elements.length + 2);
    indexData[0] = XKT_INFO.xktVersion;
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