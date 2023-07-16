import {createAABB3Int16, expandAABB3Points3} from "@xeokit/boundaries";
import type {FloatArrayParam, IntArrayParam} from "@xeokit/math";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/constants";
import type {KdTree3} from "./KdTree3";
import type {KdTrianglePrim} from "./KdTrianglePrim";
import type {KdLinePrim} from "./KdLinePrim";
import type {KdPointPrim} from "./KdPointPrim";
import {PrimsKdTree3} from "./PrimsKdTree3";

const tempAABBInt16 = new Int16Array(6);

/**
 * Creates a KdTree3 that indexes the 3D primitives in the given arrays.
 *
 * This function does not care which coordinate space the primitives are in (ie. Local, World, View etc).
 *
 * This function also works for coordinates of any precision (ie. Float32Array, Float64Array, Int16Array, Int32Array etc).
 *
 * See {@link "@xeokit/kdtree3"} for usage.
 */
export function createPrimsKdTree3(primitiveType: number, positions: FloatArrayParam, indices?: IntArrayParam): PrimsKdTree3 {
    const kdTree = new PrimsKdTree3({
        aabb: <IntArrayParam>expandAABB3Points3(createAABB3Int16(), positions)
    });

    switch (primitiveType) {
        case PointsPrimitive:
            for (let i = 0, len = positions.length / 3; i < len; i++) {
                insertPoint(positions, i, kdTree);
            }
            break;
        case TrianglesPrimitive:
            if (indices) {
                for (let i = 0, len = indices.length; i < len; i += 3) {
                    insertTriangle(positions, indices[i], indices[i + 1], indices[i + 2], kdTree);
                }
            }
            break;
        case LinesPrimitive:
            if (indices) {
                for (let i = 0, len = indices.length; i < len; i += 2) {
                    insertLine(positions, indices[i], indices[i + 1], kdTree);
                }
            }
            break;
    }
    return kdTree;
}

function insertPoint(positions: FloatArrayParam, a: number, kdTree: KdTree3) {
    const ax = positions[(a * 3)];
    const ay = positions[(a * 3) + 1];
    const az = positions[(a * 3) + 2];
    const aabb = tempAABBInt16;
    aabb[0] = aabb[3] = ax;
    aabb[1] = aabb[4] = ay;
    aabb[2] = aabb[5] = az;
    kdTree.insertItem(<KdPointPrim>{a}, aabb);
}

function insertLine(positions: FloatArrayParam, a: number, b: number, kdTree: KdTree3) {
    const ax = positions[(a * 3)];
    const ay = positions[(a * 3) + 1];
    const az = positions[(a * 3) + 2];
    const bx = positions[(b * 3)];
    const by = positions[(b * 3) + 1];
    const bz = positions[(b * 3) + 2];
    const aabb = tempAABBInt16;
    aabb[0] = Math.min(ax, bx);
    aabb[1] = Math.min(ay, by);
    aabb[2] = Math.min(az, bz);
    aabb[3] = Math.max(ax, bx);
    aabb[4] = Math.max(ay, by);
    aabb[5] = Math.max(az, bz);
    kdTree.insertItem(<KdLinePrim>{a, b}, aabb);
}

function insertTriangle(positions: FloatArrayParam, a: number, b: number, c: number, kdTree: KdTree3) {
    const ax = positions[(a * 3)];
    const ay = positions[(a * 3) + 1];
    const az = positions[(a * 3) + 2];
    const bx = positions[(b * 3)];
    const by = positions[(b * 3) + 1];
    const bz = positions[(b * 3) + 2];
    const cx = positions[(c * 3)];
    const cy = positions[(c * 3) + 1];
    const cz = positions[(c * 3) + 2];
    const aabb = tempAABBInt16;
    aabb[0] = Math.min(ax, bx, cx);
    aabb[1] = Math.min(ay, by, cy);
    aabb[2] = Math.min(az, bz, cz);
    aabb[3] = Math.max(ax, bx, cx);
    aabb[4] = Math.max(ay, by, cy);
    aabb[5] = Math.max(az, bz, cz);
    kdTree.insertItem(<KdTrianglePrim>{a, b, c}, aabb);
}
