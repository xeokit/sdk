import type {DTXDataDeflated} from "./DTXDataDeflated";
import type {DTXData_v1} from "./DTXData_v1";
import * as pako from "pako";

/**
 * @private
 */
export function inflateDTX(dtxDataDeflated: DTXDataDeflated): DTXData_v1 {

    function inflate(array:any, options?: any):any {
        return (array.length === 0) ? [] : (<Uint8Array><unknown>pako.inflate(array, options)).buffer;
    }

    return <DTXData_v1>{
        positions: new Uint16Array(inflate(dtxDataDeflated.positions)),
        colors: new Uint8Array(inflate(dtxDataDeflated.colors)),
        indices: new Uint32Array(inflate(dtxDataDeflated.indices)),
        edgeIndices: new Uint32Array(inflate(dtxDataDeflated.edgeIndices)),
        aabbs: new Float32Array(inflate(dtxDataDeflated.aabbs)),
        eachGeometryPositionsBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryPositionsBase)),
        eachGeometryColorsBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryColorsBase)),
        eachGeometryIndicesBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryIndicesBase)),
        eachGeometryEdgeIndicesBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryEdgeIndicesBase)),
        eachGeometryPrimitiveType: new Uint8Array(inflate(dtxDataDeflated.eachGeometryPrimitiveType)),
        eachGeometryAABBBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryAABBBase)),
        matrices: new Float64Array(inflate(dtxDataDeflated.matrices)),
        eachMeshGeometriesBase: new Uint32Array(inflate(dtxDataDeflated.eachMeshGeometriesBase)),
        eachMeshMatricesBase: new Uint32Array(inflate(dtxDataDeflated.eachMeshMatricesBase)),
        eachMeshMaterialAttributes: new Uint8Array(inflate(dtxDataDeflated.eachMeshMaterialAttributes)),
        eachObjectId: JSON.parse(pako.inflate(dtxDataDeflated.eachObjectId, {to: 'string'})),
        eachObjectMeshesBase: new Uint32Array(inflate(dtxDataDeflated.eachObjectMeshesBase))
    };
}
