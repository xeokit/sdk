import type {XKTDataDeflated} from "./XKTDataDeflated";
import type {XKTData} from "./XKTData";
import * as pako from "pako";

/**
 * @private
 */
export function inflateXKT(xktDataDeflated: XKTDataDeflated): XKTData {

    function inflate(array:any, options?: any):any {
        return (array.length === 0) ? [] : (<Uint8Array><unknown>pako.inflate(array, options)).buffer;
    }

    return <XKTData>{
        metadata: JSON.parse(pako.inflate(xktDataDeflated.metadata, {to: 'string'})),
        textureData: new Uint8Array(inflate(xktDataDeflated.textureData)),
        eachTextureDataPortion: new Uint32Array(inflate(xktDataDeflated.eachTextureDataPortion)),
        eachTextureAttributes: new Uint16Array(inflate(xktDataDeflated.eachTextureAttributes)),
        positions: new Uint16Array(inflate(xktDataDeflated.positions)),
        colors: new Uint8Array(inflate(xktDataDeflated.colors)),
        uvs: new Float32Array(inflate(xktDataDeflated.uvs)),
        indices8Bit: new Uint8Array(inflate(xktDataDeflated.indices8Bit)),
        indices16Bit: new Uint16Array(inflate(xktDataDeflated.indices16Bit)),
        indices32Bit: new Uint32Array(inflate(xktDataDeflated.indices32Bit)),
        edgeIndices8Bit: new Uint8Array(inflate(xktDataDeflated.edgeIndices8Bit)),
        edgeIndices16Bit: new Uint16Array(inflate(xktDataDeflated.edgeIndices16Bit)),
        edgeIndices32Bit: new Uint32Array(inflate(xktDataDeflated.edgeIndices32Bit)),
        eachTextureSetTextures: new Int32Array(inflate(xktDataDeflated.eachTextureSetTextures)),
        decodeMatrices: new Float32Array(inflate(xktDataDeflated.decodeMatrices)),
        eachBucketPositionsPortion: new Uint32Array(inflate(xktDataDeflated.eachBucketPositionsPortion)),
        eachBucketColorsPortion: new Uint32Array(inflate(xktDataDeflated.eachBucketColorsPortion)),
        eachBucketUVsPortion: new Uint32Array(inflate(xktDataDeflated.eachBucketUVsPortion)),
        eachBucketIndicesPortion: new Uint32Array(inflate(xktDataDeflated.eachBucketIndicesPortion)),
        eachBucketEdgeIndicesPortion: new Uint32Array(inflate(xktDataDeflated.eachBucketEdgeIndicesPortion)),
        eachBucketIndicesBitness: new Uint8Array(inflate(xktDataDeflated.eachBucketIndicesBitness)),
        eachGeometryPrimitiveType: new Uint8Array(inflate(xktDataDeflated.eachGeometryPrimitiveType)),
        eachGeometryBucketPortion: new Uint32Array(inflate(xktDataDeflated.eachGeometryBucketPortion)),
        eachGeometryDecodeMatricesPortion: new Uint32Array(inflate(xktDataDeflated.eachGeometryDecodeMatricesPortion)),
        matrices: new Float32Array(inflate(xktDataDeflated.matrices)), // Can be -1
        eachMeshGeometriesPortion: new Uint32Array(inflate(xktDataDeflated.eachMeshGeometriesPortion)),
        eachMeshMatricesPortion: new Uint32Array(inflate(xktDataDeflated.eachMeshMatricesPortion)),
        eachMeshTextureSet: new Int32Array(inflate(xktDataDeflated.eachMeshTextureSet)),
        eachMeshMaterialAttributes: new Uint8Array(inflate(xktDataDeflated.eachMeshMaterialAttributes)),
        eachObjectId: JSON.parse(pako.inflate(xktDataDeflated.eachObjectId, {to: 'string'})),
        eachObjectMeshesPortion: new Uint32Array(inflate(xktDataDeflated.eachObjectMeshesPortion)),
    };
}