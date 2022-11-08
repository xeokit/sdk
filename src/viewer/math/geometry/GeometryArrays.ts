
import {FloatArrayType, IntArrayType} from "../../math/index";

/**
 * GeometryBucketHandle data arrays.
 */
export type GeometryArrays = {
    primitive?: string,
    positions: FloatArrayType,
    normals?: FloatArrayType,
    uv?: FloatArrayType,
    indices?: IntArrayType
};