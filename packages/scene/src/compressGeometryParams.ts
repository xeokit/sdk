import {createMat4} from "@xeokit/matrix";
import {collapseAABB3, expandAABB3Points3} from "@xeokit/boundaries";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "@xeokit/constants";
import {quantizePositions3} from "@xeokit/compression";

import {buildEdgeIndices} from "./buildEdgeIndices";
import {uniquifyPositions} from "./calculateUniquePositions";
import {rebucketPositions} from "./rebucketPositions";
import type {GeometryParams} from "./GeometryParams";
import type {GeometryCompressedParams} from "./GeometryCompressedParams";
import type {IntArrayParam} from "@xeokit/math";

/**
 * Compresses a {@link @xeokit/scene!GeometryParams | GeometryParams} into a {@link @xeokit/scene!GeometryCompressedParams | GeometryCompressedParams}.
 *
 * See {@link @xeokit/scene} for usage examples.
 *
 * @param geometryParams Uncompressed geometry params.
 * @returns Compressed geometry params.
 */
export function compressGeometryParams(geometryParams: GeometryParams): GeometryCompressedParams {
    const positionsDecompressMatrix = createMat4();
    const aabb = collapseAABB3();
    expandAABB3Points3(aabb, geometryParams.positions);
    const positionsCompressed = quantizePositions3(geometryParams.positions, aabb, positionsDecompressMatrix);
    const edgeIndices = (geometryParams.primitive === SolidPrimitive || geometryParams.primitive === SurfacePrimitive || geometryParams.primitive === TrianglesPrimitive) && geometryParams.indices
        ? buildEdgeIndices(positionsCompressed, geometryParams.indices, positionsDecompressMatrix, 10)
        : null;
    let uniquePositionsCompressed: IntArrayParam;
    let uniqueIndices: Uint32Array;
    let uniqueEdgeIndices: Uint32Array | undefined;
    [
        uniquePositionsCompressed,
        uniqueIndices,
        uniqueEdgeIndices
    ] = uniquifyPositions({
        positionsCompressed,
        uvs: geometryParams.uvs,
        indices: geometryParams.indices,
        edgeIndices: edgeIndices
    });
    const numUniquePositions = uniquePositionsCompressed.length / 3;
    const geometryBuckets = <{
        positionsCompressed: IntArrayParam,
        indices: IntArrayParam,
        edgeIndices: IntArrayParam
    }[]>rebucketPositions({
        positionsCompressed: uniquePositionsCompressed,
        indices: uniqueIndices,
        edgeIndices: uniqueEdgeIndices,
    }, (numUniquePositions > (1 << 16)) ? 16 : 8);
    return { // Assume that closed triangle mesh is decomposed into open surfaces
        id: geometryParams.id,
        primitive: (geometryParams.primitive === SolidPrimitive && geometryBuckets.length > 1) ? TrianglesPrimitive : geometryParams.primitive,
        aabb,
        positionsDecompressMatrix,
        uvsDecompressMatrix: undefined,
        geometryBuckets
    };
}