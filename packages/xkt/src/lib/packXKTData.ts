import {XKTDataDeflated} from "./XKTDataDeflated";
import {XKTData} from "./XKTData";
import {deflateXKTData} from "./deflateXKTData";

/**
 * Packs an {@link XKTDataDeflated} into an ArrayBuffer.
 *
 * @param xktDataDeflated
 */

export function packXKTData(xktDataInflated: XKTData): ArrayBuffer {
    const xktDataDeflated: XKTDataDeflated = deflateXKTData(xktDataInflated);
    ///
    return null;
}


/**
 * Deflates XKT data.
 *
 * Deflates an {@link XKTData} into an {@link XKTDataDeflated}.
 *
 * @param xktDataInflated
 * @private
 */
export function deflateXKTData(xktDataInflated: XKTData): XKTDataDeflated {
    let metaModelBytes;
    if (metaModelJSON) {
        const deflatedJSON = deflateJSON(metaModelJSON);
        metaModelBytes = pako.deflate(deflatedJSON)
    } else {
        // const deflatedJSON = deflateJSON(xktDataInflated.metadata);
        // metaModelBytes = pako.deflate(deflatedJSON)
    }
    return <XKTDataDeflated>{
        metadata: metaModelBytes,
        textureData: pako.deflate(xktDataInflated.textureData.buffer),
        eachTextureDataPortion: pako.deflate(xktDataInflated.eachTextureDataPortion.buffer),
        eachTextureAttributes: pako.deflate(xktDataInflated.eachTextureAttributes.buffer),

        positions: pako.deflate(xktDataInflated.positions.buffer),
        colors: pako.deflate(xktDataInflated.colors.buffer),
        uvs: pako.deflate(xktDataInflated.uvs.buffer),

        indices8Bit: pako.deflate(xktDataInflated.indices8Bit.buffer),
        indices16Bit: pako.deflate(xktDataInflated.indices16Bit.buffer),
        indices32Bit: pako.deflate(xktDataInflated.indices32Bit.buffer),

        edgeIndices8Bit: pako.deflate(xktDataInflated.edgeIndices8Bit.buffer),
        edgeIndices16Bit: pako.deflate(xktDataInflated.edgeIndices16Bit.buffer),
        edgeIndices32Bit: pako.deflate(xktDataInflated.edgeIndices32Bit.buffer),
        eachTextureSetTextures: pako.deflate(xktDataInflated.eachTextureSetTextures.buffer),

        decodeMatrices: pako.deflate(xktDataInflated.decodeMatrices.buffer),

        eachBucketPositionsPortion: pako.deflate(xktDataInflated.eachBucketPositionsPortion.buffer),
        eachBucketColorsPortion: pako.deflate(xktDataInflated.eachBucketColorsPortion.buffer),
        eachBucketUVsPortion: pako.deflate(xktDataInflated.eachBucketUVsPortion.buffer),
        eachBucketIndicesPortion: pako.deflate(xktDataInflated.eachBucketIndicesPortion.buffer),

        eachBucketEdgeIndicesPortion: pako.deflate(xktDataInflated.eachBucketEdgeIndicesPortion.buffer),
        eachBucketIndicesBitness: pako.deflate(xktDataInflated.eachBucketIndicesBitness.buffer),
        eachGeometryPrimitiveType: pako.deflate(xktDataInflated.eachGeometryPrimitiveType.buffer),
        eachGeometryBucketPortion: pako.deflate(xktDataInflated.eachGeometryBucketPortion.buffer),

        eachGeometryDecodeMatricesPortion: pako.deflate(xktDataInflated.eachGeometryDecodeMatricesPortion.buffer),
        matrices: pako.deflate(xktDataInflated.matrices.buffer),
        eachMeshGeometriesPortion: pako.deflate(xktDataInflated.eachMeshGeometriesPortion.buffer),
        eachMeshMatricesPortion: pako.deflate(xktDataInflated.eachMeshMatricesPortion.buffer),

        eachMeshTextureSet: pako.deflate(xktDataInflated.eachMeshTextureSet.buffer),
        eachMeshMaterialAttributes: pako.deflate(xktDataInflated.eachMeshMaterialAttributes.buffer),
        eachObjectId: pako.deflate(JSON.stringify(xktDataInflated.eachObjectId)
            .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
                return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
            })),
        eachObjectMeshesPortion: pako.deflate(xktDataInflated.eachObjectMeshesPortion.buffer)
    };
}

function deflateJSON(strings:string[]): string {
    return JSON.stringify(strings)
        .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
            return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
        });
}
