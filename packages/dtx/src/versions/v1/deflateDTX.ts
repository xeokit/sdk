import type {DTXDataDeflated} from "./DTXDataDeflated";
import type {DTXData} from "./DTXData";
import * as pako from "pako";

/**
 * @private
 */
export function deflateDTX(dtxData: DTXData, options: { deflateLevel: 0 | 1 | -1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }): DTXDataDeflated {
    const pakoOptions: pako.DeflateFunctionOptions = {level: options.deflateLevel};
    return <DTXDataDeflated>{
        positions: pako.deflate(dtxData.positions.buffer, pakoOptions),
        colors: pako.deflate(dtxData.colors.buffer, pakoOptions),
        indices: pako.deflate(dtxData.indices.buffer, pakoOptions),
        edgeIndices: pako.deflate(dtxData.edgeIndices.buffer, pakoOptions),
        aabbs: pako.deflate(dtxData.aabbs.buffer, pakoOptions),
        eachGeometryPositionsBase: pako.deflate(dtxData.eachGeometryPositionsBase.buffer, pakoOptions),
        eachGeometryColorsBase: pako.deflate(dtxData.eachGeometryColorsBase.buffer, pakoOptions),
        eachGeometryIndicesBase: pako.deflate(dtxData.eachGeometryIndicesBase.buffer, pakoOptions),
        eachGeometryEdgeIndicesBase: pako.deflate(dtxData.eachGeometryEdgeIndicesBase.buffer, pakoOptions),
        eachGeometryPrimitiveType: pako.deflate(dtxData.eachGeometryPrimitiveType.buffer, pakoOptions),
        eachGeometryAABBBase: pako.deflate(dtxData.eachGeometryAABBBase.buffer, pakoOptions),
        matrices: pako.deflate(dtxData.matrices.buffer, pakoOptions),
        eachMeshGeometriesBase: pako.deflate(dtxData.eachMeshGeometriesBase.buffer, pakoOptions),
        eachMeshMatricesBase: pako.deflate(dtxData.eachMeshMatricesBase.buffer, pakoOptions),
        eachMeshMaterialAttributes: pako.deflate(dtxData.eachMeshMaterialAttributes.buffer, pakoOptions),
        eachObjectId: pako.deflate(JSON.stringify(dtxData.eachObjectId)
            .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
                return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
            }), pakoOptions),
        eachObjectMeshesBase: pako.deflate(dtxData.eachObjectMeshesBase.buffer, pakoOptions)
    };
}
