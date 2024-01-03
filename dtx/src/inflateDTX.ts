import type {DTXDataDeflated} from "./DTXDataDeflated";
import type {DTXData} from "./DTXData";
import * as pako from "pako";

/**
 * @private
 */
export function inflateDTX(DTXDataDeflated: DTXDataDeflated): DTXData {

    function inflate(array:any, options?: any):any {
        return (array.length === 0) ? [] : (<Uint8Array><unknown>pako.inflate(array, options)).buffer;
    }

    return <DTXData>{
        metadata: JSON.parse(pako.inflate(DTXDataDeflated.metadata, {to: 'string'})),
        textureData: new Uint8Array(inflate(DTXDataDeflated.textureData)),
        eachTextureDataPortion: new Uint32Array(inflate(DTXDataDeflated.eachTextureDataPortion)),
        eachTextureAttributes: new Uint16Array(inflate(DTXDataDeflated.eachTextureAttributes)),
        positions: new Uint16Array(inflate(DTXDataDeflated.positions)),
        colors: new Uint8Array(inflate(DTXDataDeflated.colors)),
        uvs: new Float32Array(inflate(DTXDataDeflated.uvs)),
        indices8Bit: new Uint8Array(inflate(DTXDataDeflated.indices8Bit)),
        indices16Bit: new Uint16Array(inflate(DTXDataDeflated.indices16Bit)),
        indices32Bit: new Uint32Array(inflate(DTXDataDeflated.indices32Bit)),
        edgeIndices8Bit: new Uint8Array(inflate(DTXDataDeflated.edgeIndices8Bit)),
        edgeIndices16Bit: new Uint16Array(inflate(DTXDataDeflated.edgeIndices16Bit)),
        edgeIndices32Bit: new Uint32Array(inflate(DTXDataDeflated.edgeIndices32Bit)),
        eachTextureSetTextures: new Int32Array(inflate(DTXDataDeflated.eachTextureSetTextures)),
        decodeMatrices: new Float32Array(inflate(DTXDataDeflated.decodeMatrices)),
        eachBucketPositionsPortion: new Uint32Array(inflate(DTXDataDeflated.eachBucketPositionsPortion)),
        eachBucketColorsPortion: new Uint32Array(inflate(DTXDataDeflated.eachBucketColorsPortion)),
        eachBucketUVsPortion: new Uint32Array(inflate(DTXDataDeflated.eachBucketUVsPortion)),
        eachBucketIndicesPortion: new Uint32Array(inflate(DTXDataDeflated.eachBucketIndicesPortion)),
        eachBucketEdgeIndicesPortion: new Uint32Array(inflate(DTXDataDeflated.eachBucketEdgeIndicesPortion)),
        eachBucketIndicesBitness: new Uint8Array(inflate(DTXDataDeflated.eachBucketIndicesBitness)),
        eachGeometryPrimitiveType: new Uint8Array(inflate(DTXDataDeflated.eachGeometryPrimitiveType)),
        eachGeometryBucketPortion: new Uint32Array(inflate(DTXDataDeflated.eachGeometryBucketPortion)),
        eachGeometryDecodeMatricesPortion: new Uint32Array(inflate(DTXDataDeflated.eachGeometryDecodeMatricesPortion)),
        matrices: new Float32Array(inflate(DTXDataDeflated.matrices)), // Can be -1
        eachMeshGeometriesPortion: new Uint32Array(inflate(DTXDataDeflated.eachMeshGeometriesPortion)),
        eachMeshMatricesPortion: new Uint32Array(inflate(DTXDataDeflated.eachMeshMatricesPortion)),
        eachMeshTextureSet: new Uint32Array(inflate(DTXDataDeflated.eachMeshTextureSet)),
        eachMeshMaterialAttributes: new Uint8Array(inflate(DTXDataDeflated.eachMeshMaterialAttributes)),
        eachObjectId: JSON.parse(pako.inflate(DTXDataDeflated.eachObjectId, {to: 'string'})),
        eachObjectMeshesPortion: new Uint32Array(inflate(DTXDataDeflated.eachObjectMeshesPortion)),
    };
}