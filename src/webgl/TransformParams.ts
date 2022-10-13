import {FloatArrayType} from "../viewer/math/math";

/**
 * Transform creation parameters for {@link SceneModel.createTransform}.
 */
export interface TransformParams {

    /**
     * ID for the {@link Transform}.
     */
    id: string,

    /**
     * ID of the parent {@link Transform}.
     */
    parentTransformId?: string,

    /**
     * 4x4 matrix that defines the transformation.
     */
    matrix: FloatArrayType,
}