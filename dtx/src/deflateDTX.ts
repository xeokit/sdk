import type {DTXDataDeflated} from "./DTXDataDeflated";
import type {DTXData} from "./DTXData";
import * as pako from "pako";

/**
 * @private
 */
export function deflateDTX(DTXData: DTXData, metaModelJSON?: any): DTXDataDeflated {
    let metaModelBytes;
    if (metaModelJSON) {
        const deflatedJSON = deflateJSON(metaModelJSON);
        metaModelBytes = pako.deflate(deflatedJSON)
    } else {
        const deflatedJSON = deflateJSON(["{}"]);
        metaModelBytes = pako.deflate(deflatedJSON)
    }
    return <DTXDataDeflated>{
        metadata: metaModelBytes,
        textureData: pako.deflate(DTXData.textureData.buffer),
        eachTextureDataPortion: pako.deflate(DTXData.eachTextureDataPortion.buffer),
        eachTextureAttributes: pako.deflate(DTXData.eachTextureAttributes.buffer),
        positions: pako.deflate(DTXData.positions.buffer),
        colors: pako.deflate(DTXData.colors.buffer),
        uvs: pako.deflate(DTXData.uvs.buffer),
        indices8Bit: pako.deflate(DTXData.indices8Bit.buffer),
        indices16Bit: pako.deflate(DTXData.indices16Bit.buffer),
        indices32Bit: pako.deflate(DTXData.indices32Bit.buffer),
        edgeIndices8Bit: pako.deflate(DTXData.edgeIndices8Bit.buffer),
        edgeIndices16Bit: pako.deflate(DTXData.edgeIndices16Bit.buffer),
        edgeIndices32Bit: pako.deflate(DTXData.edgeIndices32Bit.buffer),
        eachTextureSetTextures: pako.deflate(DTXData.eachTextureSetTextures.buffer),
        decodeMatrices: pako.deflate(DTXData.decodeMatrices.buffer),
        eachBucketPositionsPortion: pako.deflate(DTXData.eachBucketPositionsPortion.buffer),
        eachBucketColorsPortion: pako.deflate(DTXData.eachBucketColorsPortion.buffer),
        eachBucketUVsPortion: pako.deflate(DTXData.eachBucketUVsPortion.buffer),
        eachBucketIndicesPortion: pako.deflate(DTXData.eachBucketIndicesPortion.buffer),
        eachBucketEdgeIndicesPortion: pako.deflate(DTXData.eachBucketEdgeIndicesPortion.buffer),
        eachBucketIndicesBitness: pako.deflate(DTXData.eachBucketIndicesBitness.buffer),
        eachGeometryPrimitiveType: pako.deflate(DTXData.eachGeometryPrimitiveType.buffer),
        eachGeometryBucketPortion: pako.deflate(DTXData.eachGeometryBucketPortion.buffer),
        eachGeometryDecodeMatricesPortion: pako.deflate(DTXData.eachGeometryDecodeMatricesPortion.buffer),
        matrices: pako.deflate(DTXData.matrices.buffer),
        eachMeshGeometriesPortion: pako.deflate(DTXData.eachMeshGeometriesPortion.buffer),
        eachMeshMatricesPortion: pako.deflate(DTXData.eachMeshMatricesPortion.buffer),
        eachMeshTextureSet: pako.deflate(DTXData.eachMeshTextureSet.buffer),
        eachMeshMaterialAttributes: pako.deflate(DTXData.eachMeshMaterialAttributes.buffer),
        eachObjectId: pako.deflate(JSON.stringify(DTXData.eachObjectId)
            .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
                return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
            })),
        eachObjectMeshesPortion: pako.deflate(DTXData.eachObjectMeshesPortion.buffer)
    };
}

function deflateJSON(strings: string[]): string {
    return JSON.stringify(strings)
        .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
            return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        });
}
