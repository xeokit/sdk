import {createMat4, createVec3} from "@xeokit/matrix";
import {collapseAABB3, expandAABB3Points3} from "@xeokit/boundaries";
import {PointsPrimitive, SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "@xeokit/constants";
import {compressRGBColors, quantizePositions3} from "@xeokit/compression";

import {buildEdgeIndices} from "./buildEdgeIndices";
import {uniquifyPositions} from "./calculateUniquePositions";
import {rebucketPositions} from "./rebucketPositions";
import type {SceneGeometryParams} from "./SceneGeometryParams";
import type {SceneGeometryCompressedParams} from "./SceneGeometryCompressedParams";
import type {IntArrayParam} from "@xeokit/math";

const rtcCenter = createVec3();

/**
 * Compresses a {@link @xeokit/scene!SceneGeometryParams | SceneGeometryParams} into a {@link @xeokit/scene!SceneGeometryCompressedParams | SceneGeometryCompressedParams}.
 *
 * See {@link @xeokit/scene} for usage examples.
 *
 * @param geometryParams Uncompressed geometry params.
 * @returns Compressed geometry params.
 */
export function compressGeometryParams(geometryParams: SceneGeometryParams): SceneGeometryCompressedParams {
    // const rtcNeeded = worldToRTCPositions(geometryParams.positions, geometryParams.positions, rtcCenter);
    const positionsDecompressMatrix = createMat4();
    const aabb = collapseAABB3();
    expandAABB3Points3(aabb, geometryParams.positions);
    const positionsCompressed = quantizePositions3(geometryParams.positions, aabb, positionsDecompressMatrix);
    const edgeIndices = (geometryParams.primitive === SolidPrimitive || geometryParams.primitive === SurfacePrimitive || geometryParams.primitive === TrianglesPrimitive) && geometryParams.indices
        ? buildEdgeIndices(positionsCompressed, geometryParams.indices, positionsDecompressMatrix, 10)
        : null;
    if (geometryParams.primitive === PointsPrimitive) {
        const geometryCompressedParams: SceneGeometryCompressedParams = {
            id: geometryParams.id,
            primitive: PointsPrimitive,
            aabb,
            positionsDecompressMatrix,
            uvsDecompressMatrix: undefined,
            geometryBuckets: [{
                positionsCompressed,
                colorsCompressed: geometryParams.colors ? compressRGBColors(geometryParams.colors) : null
            }]
        };
        return geometryCompressedParams;
    } else {
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
            edgeIndices
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
        const geometryCompressedParams: SceneGeometryCompressedParams = { // Assume that closed triangle mesh is decomposed into open surfaces
            id: geometryParams.id,
            primitive: (geometryParams.primitive === SolidPrimitive && geometryBuckets.length > 1) ? TrianglesPrimitive : geometryParams.primitive,
            aabb,
            positionsDecompressMatrix,
            uvsDecompressMatrix: undefined,
            geometryBuckets
        };
        // if (rtcNeeded) {
        //     geometryCompressedParams.origin = createVec3(rtcCenter);
        // }
        return geometryCompressedParams;
    }
}
