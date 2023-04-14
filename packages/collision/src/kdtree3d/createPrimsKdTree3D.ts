import {createAABB3Int16, expandAABB3Points3} from "@xeokit/math/src/boundaries";
import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";
import {LinesPrimitive, PointsPrimitive, TrianglesPrimitive} from "@xeokit/core/constants";
import {KdTree3D} from "./KdTree3D";
import {KdTriangle3D} from "./KdTriangle3D";
import {KdLine3D} from "./KdLine3D";
import {KdPoint3D} from "./KdPoint3D";
import {PrimsKdTree3D} from "./PrimsKdTree3D";

const tempAABBInt16 = new Int16Array(6);

/**
 * Creates a KdTree3D that indexes the 3D primitives in the given arrays.
 *
 * This function does not care which coordinate space the primitives are in (ie. Local, World, View etc).
 *
 * This function also works for coordinates of any precision (ie. Float32Array, Float64Array, Int16Array, Int32Array etc).
 */
export function createPrimsKdTree3D(primitiveType: number, positions: FloatArrayParam, indices?: IntArrayParam): PrimsKdTree3D {
    const kdTree = new PrimsKdTree3D({
        aabb: <IntArrayParam>expandAABB3Points3(createAABB3Int16(), positions)
    });

    switch (primitiveType) {
        case PointsPrimitive:
            for (let i = 0, len = positions.length / 3; i < len; i++) {
                insertPoint(positions, i, kdTree);
            }
            break;
        case TrianglesPrimitive:
            for (let i = 0, len = indices.length; i < len; i += 3) {
                insertTriangle(positions, indices[i], indices[i + 1], indices[i + 2], kdTree);
            }
            break;
        case LinesPrimitive:
            for (let i = 0, len = indices.length; i < len; i += 2) {
                insertLine(positions, indices[i], indices[i + 1], kdTree);
            }
            break;
    }
    return kdTree;
}

function insertPoint(positions: FloatArrayParam, a: number, kdTree: KdTree3D) {
    const ax = positions[(a * 3)];
    const ay = positions[(a * 3) + 1];
    const az = positions[(a * 3) + 2];
    const aabb = tempAABBInt16;
    aabb[0] = aabb[3] = ax;
    aabb[1] = aabb[4] = ay;
    aabb[2] = aabb[5] = az;
    kdTree.insertItem(<KdPoint3D>{a}, aabb);
}

function insertLine(positions: FloatArrayParam, a: number, b: number, kdTree: KdTree3D) {
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
    kdTree.insertItem(<KdLine3D>{a, b}, aabb);
}

function insertTriangle(positions: FloatArrayParam, a: number, b: number, c: number, kdTree: KdTree3D) {
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
    kdTree.insertItem(<KdTriangle3D>{a, b, c}, aabb);
}
