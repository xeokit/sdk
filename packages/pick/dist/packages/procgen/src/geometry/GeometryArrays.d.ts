/**
 * GeometryBucketHandle data arrays.
 */
import { FloatArrayParam, IntArrayParam } from "@xeokit/math";
/**
 * TODO
 */
export declare type GeometryArrays = {
    primitive: number;
    positions: FloatArrayParam;
    normals?: FloatArrayParam;
    uv?: FloatArrayParam;
    indices?: IntArrayParam;
};
