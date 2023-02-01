import {XKTDataDeflated} from "./XKTDataDeflated";
import {XKTData} from "./XKTData";
import {pako} from "pako";

/**
 * @private
 */
export function deflateXKT(xktData: XKTData, metaModelJSON?: any): XKTDataDeflated {
    let metaModelBytes;
    if (metaModelJSON) {
        const deflatedJSON = deflateJSON(metaModelJSON);
        metaModelBytes = pako.deflate(deflatedJSON)
    } else {
        // const deflatedJSON = deflateJSON(xktData.metadata);
        // metaModelBytes = pako.deflate(deflatedJSON)
    }
    return <XKTDataDeflated>{
        metadata: metaModelBytes,
        textureData: pako.deflate(xktData.textureData.buffer),
        eachTextureDataPortion: pako.deflate(xktData.eachTextureDataPortion.buffer),
        eachTextureAttributes: pako.deflate(xktData.eachTextureAttributes.buffer),
        positions: pako.deflate(xktData.positions.buffer),
        colors: pako.deflate(xktData.colors.buffer),
        uvs: pako.deflate(xktData.uvs.buffer),
        indices8Bit: pako.deflate(xktData.indices8Bit.buffer),
        indices16Bit: pako.deflate(xktData.indices16Bit.buffer),
        indices32Bit: pako.deflate(xktData.indices32Bit.buffer),
        edgeIndices8Bit: pako.deflate(xktData.edgeIndices8Bit.buffer),
        edgeIndices16Bit: pako.deflate(xktData.edgeIndices16Bit.buffer),
        edgeIndices32Bit: pako.deflate(xktData.edgeIndices32Bit.buffer),
        eachTextureSetTextures: pako.deflate(xktData.eachTextureSetTextures.buffer),
        decodeMatrices: pako.deflate(xktData.decodeMatrices.buffer),
        eachBucketPositionsPortion: pako.deflate(xktData.eachBucketPositionsPortion.buffer),
        eachBucketColorsPortion: pako.deflate(xktData.eachBucketColorsPortion.buffer),
        eachBucketUVsPortion: pako.deflate(xktData.eachBucketUVsPortion.buffer),
        eachBucketIndicesPortion: pako.deflate(xktData.eachBucketIndicesPortion.buffer),
        eachBucketEdgeIndicesPortion: pako.deflate(xktData.eachBucketEdgeIndicesPortion.buffer),
        eachBucketIndicesBitness: pako.deflate(xktData.eachBucketIndicesBitness.buffer),
        eachGeometryPrimitiveType: pako.deflate(xktData.eachGeometryPrimitiveType.buffer),
        eachGeometryBucketPortion: pako.deflate(xktData.eachGeometryBucketPortion.buffer),
        eachGeometryDecodeMatricesPortion: pako.deflate(xktData.eachGeometryDecodeMatricesPortion.buffer),
        matrices: pako.deflate(xktData.matrices.buffer),
        eachMeshGeometriesPortion: pako.deflate(xktData.eachMeshGeometriesPortion.buffer),
        eachMeshMatricesPortion: pako.deflate(xktData.eachMeshMatricesPortion.buffer),
        eachMeshTextureSet: pako.deflate(xktData.eachMeshTextureSet.buffer),
        eachMeshMaterialAttributes: pako.deflate(xktData.eachMeshMaterialAttributes.buffer),
        eachObjectId: pako.deflate(JSON.stringify(xktData.eachObjectId)
            .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
                return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
            })),
        eachObjectMeshesPortion: pako.deflate(xktData.eachObjectMeshesPortion.buffer)
    };
}

function deflateJSON(strings: string[]): string {
    return JSON.stringify(strings)
        .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
            return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        });
}
