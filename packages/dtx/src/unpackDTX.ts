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
        indices8Bit: elements[i++],
        indices16Bit: elements[i++],
        indices32Bit: elements[i++],
        edgeIndices8Bit: elements[i++],
        edgeIndices16Bit: elements[i++],
        edgeIndices32Bit: elements[i++],
        decodeMatrices: elements[i++],
        eachBucketPositionsPortion: elements[i++],
        eachBucketColorsPortion: elements[i++],
        eachBucketIndicesPortion: elements[i++],
        eachBucketEdgeIndicesPortion: elements[i++],
        eachBucketIndicesBitness: elements[i++],
        eachGeometryPrimitiveType: elements[i++],
        eachGeometryBucketPortion: elements[i++],
        eachGeometryDecodeMatricesPortion: elements[i++],
        matrices: elements[i++],
        origins: elements[i++],
        eachMeshGeometriesPortion: elements[i++],
        eachMeshMatricesPortion: elements[i++],
        eachMeshOriginsPortion: elements[i++],
        eachMeshMaterialAttributes: elements[i++],
        eachGeometryId: elements[i++],
        eachMeshId: elements[i++],
        eachObjectId: elements[i++],
        eachObjectMeshesPortion: elements[i++]
    };
}
