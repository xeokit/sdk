
import * as math from "../math";

/**
 * GeometryBucketHandle data arrays.
 */
export type GeometryArrays = {
    primitive?: string,
    positions: math.FloatArrayParam,
    normals?: math.FloatArrayParam,
    uv?: math.FloatArrayParam,
    indices?: math.IntArrayParam
};