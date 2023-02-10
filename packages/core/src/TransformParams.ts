import type {FloatArrayParam} from "@xeokit/math/math";

/**
 * Transform creation parameters for {@link @xeokit/core/components!BuildableModel.createTransform}.
 */
export interface TransformParams {

    /**
     * ID for the transform.
     */
    id: string,

    /**
     * ID of the parent transform.
     */
    parentTransformId?: string,

    /**
     * 4x4 matrix that defines the transformation.
     */
    matrix: FloatArrayParam,
}