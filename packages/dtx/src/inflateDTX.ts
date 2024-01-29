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
        metadata: JSON.parse(pako.inflate(dtxDataDeflated.metadata, {to: 'string'})),
        textureData: new Uint8Array(inflate(dtxDataDeflated.textureData)),
        eachTextureDataPortion: new Uint32Array(inflate(dtxDataDeflated.eachTextureDataPortion)),
        eachTextureAttributes: new Uint16Array(inflate(dtxDataDeflated.eachTextureAttributes)),
        positions: new Uint16Array(inflate(dtxDataDeflated.positions)),
        colors: new Uint8Array(inflate(dtxDataDeflated.colors)),
        uvs: new Float32Array(inflate(dtxDataDeflated.uvs)),
        indices8Bit: new Uint8Array(inflate(dtxDataDeflated.indices8Bit)),
        indices16Bit: new Uint16Array(inflate(dtxDataDeflated.indices16Bit)),
        indices32Bit: new Uint32Array(inflate(dtxDataDeflated.indices32Bit)),
        edgeIndices8Bit: new Uint8Array(inflate(dtxDataDeflated.edgeIndices8Bit)),
        edgeIndices16Bit: new Uint16Array(inflate(dtxDataDeflated.edgeIndices16Bit)),
        edgeIndices32Bit: new Uint32Array(inflate(dtxDataDeflated.edgeIndices32Bit)),
        eachTextureSetTextures: new Int32Array(inflate(dtxDataDeflated.eachTextureSetTextures)),
        decodeMatrices: new Float32Array(inflate(dtxDataDeflated.decodeMatrices)),
        eachBucketPositionsPortion: new Uint32Array(inflate(dtxDataDeflated.eachBucketPositionsPortion)),
        eachBucketColorsPortion: new Uint32Array(inflate(dtxDataDeflated.eachBucketColorsPortion)),
        eachBucketUVsPortion: new Uint32Array(inflate(dtxDataDeflated.eachBucketUVsPortion)),
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
        eachMeshTextureSet: new Int32Array(inflate(dtxDataDeflated.eachMeshTextureSet)),
        eachMeshMaterialAttributes: new Uint8Array(inflate(dtxDataDeflated.eachMeshMaterialAttributes)),
        eachGeometryId: JSON.parse(pako.inflate(dtxDataDeflated.eachGeometryId, {to: 'string'})),
        eachMeshId: JSON.parse(pako.inflate(dtxDataDeflated.eachMeshId, {to: 'string'})),
        eachObjectId: JSON.parse(pako.inflate(dtxDataDeflated.eachObjectId, {to: 'string'})),
        eachObjectMeshesPortion: new Uint32Array(inflate(dtxDataDeflated.eachObjectMeshesPortion)),
    };
}