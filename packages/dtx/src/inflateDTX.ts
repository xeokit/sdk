import type {DTXDataDeflated} from "./DTXDataDeflated";
import type {DTXData} from "./DTXData";
import * as pako from "pako";

/**
 * @private
 */
export function inflateDTX(dtxDataDeflated: DTXDataDeflated): DTXData {

    function inflate(array:any, options?: any):any {
        return (array.length === 0) ? [] : (<Uint8Array><unknown>pako.inflate(array, options)).buffer;
    }

    return <DTXData>{
        positions: new Uint16Array(inflate(dtxDataDeflated.positions)),
        colors: new Uint8Array(inflate(dtxDataDeflated.colors)),
        indices8Bit: new Uint8Array(inflate(dtxDataDeflated.indices8Bit)),
        indices16Bit: new Uint16Array(inflate(dtxDataDeflated.indices16Bit)),
        indices32Bit: new Uint32Array(inflate(dtxDataDeflated.indices32Bit)),
        edgeIndices8Bit: new Uint8Array(inflate(dtxDataDeflated.edgeIndices8Bit)),
        edgeIndices16Bit: new Uint16Array(inflate(dtxDataDeflated.edgeIndices16Bit)),
        edgeIndices32Bit: new Uint32Array(inflate(dtxDataDeflated.edgeIndices32Bit)),
         decodeMatrices: new Float32Array(inflate(dtxDataDeflated.decodeMatrices)),
        eachBucketPositionsPortion: new Uint32Array(inflate(dtxDataDeflated.eachBucketPositionsPortion)),
        eachBucketColorsPortion: new Uint32Array(inflate(dtxDataDeflated.eachBucketColorsPortion)),
        eachBucketIndicesPortion: new Uint32Array(inflate(dtxDataDeflated.eachBucketIndicesPortion)),
        eachBucketEdgeIndicesPortion: new Uint32Array(inflate(dtxDataDeflated.eachBucketEdgeIndicesPortion)),
        eachBucketIndicesBitness: new Uint8Array(inflate(dtxDataDeflated.eachBucketIndicesBitness)),
        eachGeometryPrimitiveType: new Uint8Array(inflate(dtxDataDeflated.eachGeometryPrimitiveType)),
        eachGeometryBucketPortion: new Uint32Array(inflate(dtxDataDeflated.eachGeometryBucketPortion)),
        eachGeometryDecodeMatricesPortion: new Uint32Array(inflate(dtxDataDeflated.eachGeometryDecodeMatricesPortion)),
        matrices: new Float32Array(inflate(dtxDataDeflated.matrices)),
        origins: new Float64Array(inflate(dtxDataDeflated.origins)),
        eachMeshGeometriesPortion: new Uint32Array(inflate(dtxDataDeflated.eachMeshGeometriesPortion)),
        eachMeshMatricesPortion: new Uint32Array(inflate(dtxDataDeflated.eachMeshMatricesPortion)),
        eachMeshOriginsPortion: new Uint32Array(inflate(dtxDataDeflated.eachMeshOriginsPortion)),
        eachMeshMaterialAttributes: new Uint8Array(inflate(dtxDataDeflated.eachMeshMaterialAttributes)),
        eachGeometryId: JSON.parse(pako.inflate(dtxDataDeflated.eachGeometryId, {to: 'string'})),
        eachMeshId: JSON.parse(pako.inflate(dtxDataDeflated.eachMeshId, {to: 'string'})),
        eachObjectId: JSON.parse(pako.inflate(dtxDataDeflated.eachObjectId, {to: 'string'})),
        eachObjectMeshesPortion: new Uint32Array(inflate(dtxDataDeflated.eachObjectMeshesPortion)),
    };
}
