import type {DTXDataDeflated} from "./DTXDataDeflated";
import type {DTXData} from "./DTXData";
import * as pako from "pako";

/**
 * @private
 */
export function deflateDTX(dtxData: DTXData): DTXDataDeflated {
    const deflatedJSON = deflateJSON(dtxData.metadata);
    const metaModelBytes = pako.deflate(deflatedJSON); // TODO
    return <DTXDataDeflated>{
        metadata: metaModelBytes,
        textureData: pako.deflate(dtxData.textureData.buffer),
        eachTextureDataPortion: pako.deflate(dtxData.eachTextureDataPortion.buffer),
        eachTextureAttributes: pako.deflate(dtxData.eachTextureAttributes.buffer),
        positions: pako.deflate(dtxData.positions.buffer),
        colors: pako.deflate(dtxData.colors.buffer),
        uvs: pako.deflate(dtxData.uvs.buffer),
        indices8Bit: pako.deflate(dtxData.indices8Bit.buffer),
        indices16Bit: pako.deflate(dtxData.indices16Bit.buffer),
        indices32Bit: pako.deflate(dtxData.indices32Bit.buffer),
        edgeIndices8Bit: pako.deflate(dtxData.edgeIndices8Bit.buffer),
        edgeIndices16Bit: pako.deflate(dtxData.edgeIndices16Bit.buffer),
        edgeIndices32Bit: pako.deflate(dtxData.edgeIndices32Bit.buffer),
        eachTextureSetTextures: pako.deflate(dtxData.eachTextureSetTextures.buffer),
        decodeMatrices: pako.deflate(dtxData.decodeMatrices.buffer),
        eachBucketPositionsPortion: pako.deflate(dtxData.eachBucketPositionsPortion.buffer),
        eachBucketColorsPortion: pako.deflate(dtxData.eachBucketColorsPortion.buffer),
        eachBucketUVsPortion: pako.deflate(dtxData.eachBucketUVsPortion.buffer),
        eachBucketIndicesPortion: pako.deflate(dtxData.eachBucketIndicesPortion.buffer),
        eachBucketEdgeIndicesPortion: pako.deflate(dtxData.eachBucketEdgeIndicesPortion.buffer),
        eachBucketIndicesBitness: pako.deflate(dtxData.eachBucketIndicesBitness.buffer),
        eachGeometryPrimitiveType: pako.deflate(dtxData.eachGeometryPrimitiveType.buffer),
        eachGeometryBucketPortion: pako.deflate(dtxData.eachGeometryBucketPortion.buffer),
        eachGeometryDecodeMatricesPortion: pako.deflate(dtxData.eachGeometryDecodeMatricesPortion.buffer),
        matrices: pako.deflate(dtxData.matrices.buffer),
        origins: pako.deflate(dtxData.origins.buffer),
        eachMeshGeometriesPortion: pako.deflate(dtxData.eachMeshGeometriesPortion.buffer),
        eachMeshMatricesPortion: pako.deflate(dtxData.eachMeshMatricesPortion.buffer),
        eachMeshOriginsPortion: pako.deflate(dtxData.eachMeshOriginsPortion.buffer),
        eachMeshTextureSet: pako.deflate(dtxData.eachMeshTextureSet.buffer),
        eachMeshMaterialAttributes: pako.deflate(dtxData.eachMeshMaterialAttributes.buffer),
        eachGeometryId: pako.deflate(JSON.stringify(dtxData.eachGeometryId)
            .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
                return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
            })),
        eachMeshId: pako.deflate(JSON.stringify(dtxData.eachMeshId)
            .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
                return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
            })),
        eachObjectId: pako.deflate(JSON.stringify(dtxData.eachObjectId)
            .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
                return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
            })),
        eachObjectMeshesPortion: pako.deflate(dtxData.eachObjectMeshesPortion.buffer)
    };
}

function deflateJSON(strings: string[]): string {
    return JSON.stringify(strings)
        .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
            return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        });
}
