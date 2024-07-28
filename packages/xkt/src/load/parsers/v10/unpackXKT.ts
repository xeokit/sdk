import type {XKTDataDeflated} from "./XKTDataDeflated";

/**
 * @private
 */
export function unpackXKT(arrayBuffer: ArrayBuffer): XKTDataDeflated {

    const dataView = new DataView(arrayBuffer);
    const dataArray = new Uint8Array(arrayBuffer);
    const xktVersion = dataView.getUint32(0, true);
    const numElements = dataView.getUint32(4, true);

    console.log(`Parsing XKT v${xktVersion}`)
    const elements = [];
    let byteOffset = (numElements + 2) * 4;
    for (let i = 0; i < numElements; i++) {
        const elementSize = dataView.getUint32((i + 2) * 4, true);
        elements.push(dataArray.subarray(byteOffset, byteOffset + elementSize));
        byteOffset += elementSize;
    }

    let i = 0;

    return <XKTDataDeflated>{
        metadata: elements[i++],
        textureData: elements[i++],
        eachTextureDataPortion: elements[i++],
        eachTextureAttributes: elements[i++],
        positions: elements[i++],
        normals: elements[i++],
        colors: elements[i++],
        uvs: elements[i++],
        indices: elements[i++],
        edgeIndices: elements[i++],
        eachTextureSetTextures: elements[i++],
        matrices: elements[i++],
        reusedGeometriesDecodeMatrix: elements[i++],
        eachGeometryPrimitiveType: elements[i++],
        eachGeometryPositionsPortion: elements[i++],
        eachGeometryNormalsPortion: elements[i++],
        eachGeometryColorsPortion: elements[i++],
        eachGeometryUVsPortion: elements[i++],
        eachGeometryIndicesPortion: elements[i++],
        eachGeometryEdgeIndicesPortion: elements[i++],
        eachMeshGeometriesPortion: elements[i++],
        eachMeshMatricesPortion: elements[i++],
        eachMeshTextureSet: elements[i++],
        eachMeshMaterialAttributes: elements[i++],
        eachEntityId: elements[i++],
        eachEntityMeshesPortion: elements[i++],
        eachTileAABB: elements[i++],
        eachTileEntitiesPortion: elements[i++],
    };
}
