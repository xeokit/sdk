
import {createMat4, createVec3} from "@xeokit/math/matrix";
import {collapseAABB3, expandAABB3Points3, getPositionsCenter} from "@xeokit/math/boundaries";
import {SolidPrimitive, SurfacePrimitive, TrianglesPrimitive} from "@xeokit/core/constants";
import {FloatArrayParam} from "@xeokit/math/math";
import {quantizePositions} from "@xeokit/math/compression";

import {buildEdgeIndices} from "./buildEdgeIndices";
import {uniquifyPositions} from "./calculateUniquePositions";
import {rebucketPositions} from "./rebucketPositions";
import {GeometryParams} from "./GeometryParams";
import {GeometryCompressedParams} from "./GeometryCompressedParams";

const tempVec3a = createVec3();

/**
 * Compresses a {@link @xeokit/scene!GeometryParams | GeometryParams} into a {@link @xeokit/scene!GeometryCompressedParams|GeometryCompressedParams}.
 *
 * See {@link @xeokit/scene} for usage examples.
 *
 * @param geometryParams Uncompressed geometry params.
 * @returns Compressed geometry params.
 */
export function compressGeometryParams(geometryParams: GeometryParams): GeometryCompressedParams {
    const positionsDecompressMatrix = createMat4();
    const rtcPositions = new Float32Array(geometryParams.positions.length);
    const origin = createVec3();
    worldToRTCPositions(geometryParams.positions, geometryParams.origin, rtcPositions, origin);
    const aabb = collapseAABB3();
    expandAABB3Points3(aabb, rtcPositions);
    const positionsCompressed = quantizePositions(rtcPositions, aabb, positionsDecompressMatrix);
    const edgeIndices = (geometryParams.primitive === SolidPrimitive || geometryParams.primitive === SurfacePrimitive || geometryParams.primitive === TrianglesPrimitive) && geometryParams.indices
        ? buildEdgeIndices(positionsCompressed, geometryParams.indices, positionsDecompressMatrix, geometryParams.edgeThreshold || 10)
        : null;
    let uniquePositionsCompressed, uniqueIndices, uniqueEdgeIndices;
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
    // @ts-ignore
    const numUniquePositions = uniquePositionsCompressed.length / 3;
    const geometryBuckets = rebucketPositions({
        // @ts-ignore
        positionsCompressed: uniquePositionsCompressed,
        // @ts-ignore
        indices: uniqueIndices,
        // @ts-ignore
        edgeIndices: uniqueEdgeIndices,
    }, (numUniquePositions > (1 << 16)) ? 16 : 8);
    return {
        id: geometryParams.id,
        primitive: (geometryParams.primitive === SolidPrimitive && geometryBuckets.length > 1) // Assume that closed triangle mesh is decomposed into open surfaces
            ? TrianglesPrimitive
            : geometryParams.primitive,
        origin,
        aabb,
        positionsDecompressMatrix,
        uvsDecompressMatrix: undefined,
        geometryBuckets
    };
}

function worldToRTCPositions(worldPositions: FloatArrayParam, origin: FloatArrayParam, rtcPositions: FloatArrayParam, rtcCenter: FloatArrayParam, cellSize = 200): boolean {
    const center = getPositionsCenter(worldPositions, tempVec3a);
    if (origin) {
        center[0] += origin[0];
        center[1] += origin[1];
        center[2] += origin[2];
    }
    const rtcCenterX = Math.round(center[0] / cellSize) * cellSize;
    const rtcCenterY = Math.round(center[1] / cellSize) * cellSize;
    const rtcCenterZ = Math.round(center[2] / cellSize) * cellSize;
    for (let i = 0, len = worldPositions.length; i < len; i += 3) {
        rtcPositions[i + 0] = worldPositions[i + 0] - rtcCenterX;
        rtcPositions[i + 1] = worldPositions[i + 1] - rtcCenterY;
        rtcPositions[i + 2] = worldPositions[i + 2] - rtcCenterZ;
    }
    rtcCenter[0] = rtcCenterX;
    rtcCenter[1] = rtcCenterY;
    rtcCenter[2] = rtcCenterZ;
    const rtcNeeded = (rtcCenter[0] !== 0 || rtcCenter[1] !== 0 || rtcCenter[2] !== 0);
    return rtcNeeded;
}