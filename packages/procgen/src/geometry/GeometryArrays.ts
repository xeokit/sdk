/**
 * GeometryBucketHandle data arrays.
 */
import {FloatArrayParam, IntArrayParam} from "@xeokit/math/math";

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