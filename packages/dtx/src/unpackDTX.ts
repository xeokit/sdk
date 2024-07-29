import type {DTXDataDeflated} from "./DTXDataDeflated";

/**
 * @private
 */
export function unpackDTX(arrayBuffer: ArrayBuffer): DTXDataDeflated {

    const dataView = new DataView(arrayBuffer);
    const dataArray = new Uint8Array(arrayBuffer);
    const dtxVersion = dataView.getUint32(0, true);
    const numElements = dataView.getUint32(4, true);

    const elements = [];
    let byteOffset = (numElements + 2) * 4;
    for (let i = 0; i < numElements; i++) {
        const elementSize = dataView.getUint32((i + 2) * 4, true);
        elements.push(dataArray.subarray(byteOffset, byteOffset + elementSize));
        byteOffset += elementSize;
    }

    let i = 0;

    return <DTXDataDeflated>{
        positions: elements[i++],
        colors: elements[i++],
        indices: elements[i++],
        edgeIndices: elements[i++],
        aabbs: elements[i++],
        eachGeometryPositionsBase: elements[i++],
        eachGeometryColorsBase: elements[i++],
        eachGeometryIndicesBase: elements[i++],
        eachGeometryEdgeIndicesBase: elements[i++],
        eachGeometryPrimitiveType: elements[i++],
        eachGeometryAABBBase: elements[i++],
        matrices: elements[i++],
        origins: elements[i++],
        eachMeshGeometriesBase: elements[i++],
        eachMeshMatricesBase: elements[i++],
        eachMeshOriginsBase: elements[i++],
        eachMeshMaterialAttributes: elements[i++],
        eachObjectId: elements[i++],
        eachObjectMeshesBase: elements[i++]
    };
}
