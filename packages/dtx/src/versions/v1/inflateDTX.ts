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
        indices: new Uint32Array(inflate(dtxDataDeflated.indices)),
        edgeIndices: new Uint32Array(inflate(dtxDataDeflated.edgeIndices)),
        aabbs: new Float32Array(inflate(dtxDataDeflated.aabbs)),
        eachGeometryPositionsBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryPositionsBase)),
        eachGeometryColorsBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryColorsBase)),
        eachGeometryIndicesBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryIndicesBase)),
        eachGeometryEdgeIndicesBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryEdgeIndicesBase)),
        eachGeometryPrimitiveType: new Uint8Array(inflate(dtxDataDeflated.eachGeometryPrimitiveType)),
        eachGeometryAABBBase: new Uint32Array(inflate(dtxDataDeflated.eachGeometryAABBBase)),
        matrices: new Float32Array(inflate(dtxDataDeflated.matrices)),
        origins: new Float64Array(inflate(dtxDataDeflated.origins)),
        eachMeshGeometriesBase: new Uint32Array(inflate(dtxDataDeflated.eachMeshGeometriesBase)),
        eachMeshMatricesBase: new Uint32Array(inflate(dtxDataDeflated.eachMeshMatricesBase)),
        eachMeshOriginsBase: new Uint32Array(inflate(dtxDataDeflated.eachMeshOriginsBase)),
        eachMeshMaterialAttributes: new Uint8Array(inflate(dtxDataDeflated.eachMeshMaterialAttributes)),
        eachObjectId: JSON.parse(pako.inflate(dtxDataDeflated.eachObjectId, {to: 'string'})),
        eachObjectMeshesBase: new Uint32Array(inflate(dtxDataDeflated.eachObjectMeshesBase))
    };
}