import {FloatArrayType} from "../math/math";

/**
 * Transform creation parameters for {@link SceneModel.createTransform}.
 */
export interface SceneTransformCfg {

    /**
     * ID for the {@link SceneTransform}.
     */
    id: string,

    /**
     * ID of the parent {@link SceneTransform}.
     */
    parentTransformId?: string,

    /**
     * 4x4 matrix that defines the transformation.
     */
    matrix: FloatArrayType,
}