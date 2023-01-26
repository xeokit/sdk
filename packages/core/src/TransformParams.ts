import type {FloatArrayParam} from "@xeokit/math/math";

/**
 * Transform creation parameters for {@link BuildableModel.createTransform}.
 */
export interface TransformParams {

    /**
     * ID for the transform.
     */
    transformId: string,

    /**
     * ID of the parent transform.
     */
    parentTransformId?: string,

    /**
     * 4x4 matrix that defines the transformation.
     */
    matrix: FloatArrayParam,
}