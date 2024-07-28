import type {XKTDataDeflated} from "./XKTDataDeflated";
import type {XKTData} from "./XKTData";
import * as pako from "pako";

/**
 * @private
 */
export function inflateXKT(xktDataDeflated: XKTDataDeflated): XKTData {

    function inflate(array: any, options?: any) : Buffer{
        // @ts-ignore
        return (array.length === 0) ? [] : pako.inflate(array, options).buffer;
    }


    return <XKTData>{
        metadata: JSON.parse(pako.inflate(xktDataDeflated.metadata, {to: 'string'})),
        textureData: new Uint8Array(inflate(xktDataDeflated.textureData)),  // <<----------------------------- ??? ZIPPing to blame?
        eachTextureDataPortion: new Uint32Array(inflate(xktDataDeflated.eachTextureDataPortion)),
        eachTextureAttributes: new Uint16Array(inflate(xktDataDeflated.eachTextureAttributes)),
        positions: new Uint16Array(inflate(xktDataDeflated.positions)),
        normals: new Int8Array(inflate(xktDataDeflated.normals)),
        colors: new Uint8Array(inflate(xktDataDeflated.colors)),
        uvs: new Float32Array(inflate(xktDataDeflated.uvs)),
        indices: new Uint32Array(inflate(xktDataDeflated.indices)),
        edgeIndices: new Uint32Array(inflate(xktDataDeflated.edgeIndices)),
        eachTextureSetTextures: new Int32Array(inflate(xktDataDeflated.eachTextureSetTextures)),
        matrices: new Float32Array(inflate(xktDataDeflated.matrices)),
        reusedGeometriesDecodeMatrix: new Float32Array(inflate(xktDataDeflated.reusedGeometriesDecodeMatrix)),
        eachGeometryPrimitiveType: new Uint8Array(inflate(xktDataDeflated.eachGeometryPrimitiveType)),
        eachGeometryPositionsPortion: new Uint32Array(inflate(xktDataDeflated.eachGeometryPositionsPortion)),
        eachGeometryNormalsPortion: new Uint32Array(inflate(xktDataDeflated.eachGeometryNormalsPortion)),
        eachGeometryColorsPortion: new Uint32Array(inflate(xktDataDeflated.eachGeometryColorsPortion)),
        eachGeometryUVsPortion: new Uint32Array(inflate(xktDataDeflated.eachGeometryUVsPortion)),
        eachGeometryIndicesPortion: new Uint32Array(inflate(xktDataDeflated.eachGeometryIndicesPortion)),
        eachGeometryEdgeIndicesPortion: new Uint32Array(inflate(xktDataDeflated.eachGeometryEdgeIndicesPortion)),
        eachMeshGeometriesPortion: new Uint32Array(inflate(xktDataDeflated.eachMeshGeometriesPortion)),
        eachMeshMatricesPortion: new Uint32Array(inflate(xktDataDeflated.eachMeshMatricesPortion)),
        eachMeshTextureSet: new Int32Array(inflate(xktDataDeflated.eachMeshTextureSet)), // Can be -1
        eachMeshMaterialAttributes: new Uint8Array(inflate(xktDataDeflated.eachMeshMaterialAttributes)),
        eachEntityId: JSON.parse(pako.inflate(xktDataDeflated.eachEntityId, {to: 'string'})),
        eachEntityMeshesPortion: new Uint32Array(inflate(xktDataDeflated.eachEntityMeshesPortion)),
        eachTileAABB: new Float64Array(inflate(xktDataDeflated.eachTileAABB)),
        eachTileEntitiesPortion: new Uint32Array(inflate(xktDataDeflated.eachTileEntitiesPortion)),
    };
}
