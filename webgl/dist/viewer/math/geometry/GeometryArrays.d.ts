import type { FloatArrayParam, IntArrayParam } from "../../math/index";
/**
 * GeometryBucketHandle data arrays.
 */
export type GeometryArrays = {
    primitive?: string;
    positions: FloatArrayParam;
    normals?: FloatArrayParam;
    uv?: FloatArrayParam;
    indices?: IntArrayParam;
};
