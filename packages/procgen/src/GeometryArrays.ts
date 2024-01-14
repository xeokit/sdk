/**
 * TrianglesLayerGeometryBucket data arrays.
 */
import {FloatArrayParam, IntArrayParam} from "@xeokit/math";

/**
 * TODO
 */
export type GeometryArrays = {
    primitive: number,
    positions: FloatArrayParam,
    normals?: FloatArrayParam,
    uv?: FloatArrayParam,
    indices?: IntArrayParam
};