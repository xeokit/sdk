
import {FloatArrayType, IntArrayType} from "../../math/index";

/**
 * Geometry data arrays.
 */
export type GeometryArrays = {
    primitive?: string,
    positions: FloatArrayType,
    normals?: FloatArrayType,
    uv?: FloatArrayType,
    indices?: IntArrayType
};