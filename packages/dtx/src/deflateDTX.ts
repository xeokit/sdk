import type {DTXDataDeflated} from "./DTXDataDeflated";
import type {DTXData} from "./DTXData";
import * as pako from "pako";


/**
 * @private
 */
export function deflateDTX(dtxData: DTXData): DTXDataDeflated {
    return <DTXDataDeflated>{
        positions: pako.deflate(dtxData.positions.buffer),
        colors: pako.deflate(dtxData.colors.buffer),
        indices: pako.deflate(dtxData.indices.buffer),
        edgeIndices: pako.deflate(dtxData.edgeIndices.buffer),
        aabbs: pako.deflate(dtxData.aabbs.buffer),
        eachGeometryPositionsBase: pako.deflate(dtxData.eachGeometryPositionsBase.buffer),
        eachGeometryColorsBase: pako.deflate(dtxData.eachGeometryColorsBase.buffer),
        eachGeometryIndicesBase: pako.deflate(dtxData.eachGeometryIndicesBase.buffer),
        eachGeometryEdgeIndicesBase: pako.deflate(dtxData.eachGeometryEdgeIndicesBase.buffer),
        eachGeometryPrimitiveType: pako.deflate(dtxData.eachGeometryPrimitiveType.buffer),
        eachGeometryAABBBase: pako.deflate(dtxData.eachGeometryAABBBase.buffer),
        matrices: pako.deflate(dtxData.matrices.buffer),
        origins: pako.deflate(dtxData.origins.buffer),
        eachMeshGeometriesBase: pako.deflate(dtxData.eachMeshGeometriesBase.buffer),
        eachMeshMatricesBase: pako.deflate(dtxData.eachMeshMatricesBase.buffer),
        eachMeshOriginsBase: pako.deflate(dtxData.eachMeshOriginsBase.buffer),
        eachMeshMaterialAttributes: pako.deflate(dtxData.eachMeshMaterialAttributes.buffer),
        eachObjectId: pako.deflate(JSON.stringify(dtxData.eachObjectId)
            .replace(/[\u007F-\uFFFF]/g, function (chr) { // Produce only ASCII-chars, so that the data can be inflated later
                return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).substr(-4)
            })),
        eachObjectMeshesBase: pako.deflate(dtxData.eachObjectMeshesBase.buffer)
    };
}
