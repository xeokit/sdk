import { XKT_INFO } from "./XKT_INFO";
/**
 * @private
 */
export function packXKT(xktDataDeflated) {
    return toArrayBuffer([
        xktDataDeflated.metadata,
        xktDataDeflated.textureData,
        xktDataDeflated.eachTextureDataPortion,
        xktDataDeflated.eachTextureAttributes,
        xktDataDeflated.positions,
        xktDataDeflated.normals,
        xktDataDeflated.colors,
        xktDataDeflated.uvs,
        xktDataDeflated.indices,
        xktDataDeflated.edgeIndices,
        xktDataDeflated.eachTextureSetTextures,
        xktDataDeflated.matrices,
        xktDataDeflated.reusedGeometriesDecodeMatrix,
        xktDataDeflated.eachGeometryPrimitiveType,
        xktDataDeflated.eachGeometryPositionsPortion,
        xktDataDeflated.eachGeometryNormalsPortion,
        xktDataDeflated.eachGeometryColorsPortion,
        xktDataDeflated.eachGeometryUVsPortion,
        xktDataDeflated.eachGeometryIndicesPortion,
        xktDataDeflated.eachGeometryEdgeIndicesPortion,
        xktDataDeflated.eachMeshGeometriesPortion,
        xktDataDeflated.eachMeshMatricesPortion,
        xktDataDeflated.eachMeshTextureSet,
        xktDataDeflated.eachMeshMaterialAttributes,
        xktDataDeflated.eachEntityId,
        xktDataDeflated.eachEntityMeshesPortion,
        xktDataDeflated.eachTileAABB,
        xktDataDeflated.eachTileEntitiesPortion
    ]);
}
function toArrayBuffer(elements) {
    const indexData = new Uint32Array(elements.length + 2);
    indexData[0] = XKT_INFO.xktVersion;
    indexData[1] = elements.length; // Stored Data 1.1: number of stored elements
    let dataLen = 0; // Stored Data 1.2: length of stored elements
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
    for (let i = 0, len = elements.length; i < len; i++) { // Stored Data 2: the elements themselves
        const element = elements[i];
        dataArray.set(element, offset);
        offset += element.length;
    }
    return dataArray.buffer;
}
//# sourceMappingURL=packXKT.js.map