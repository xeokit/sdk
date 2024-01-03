import type { FloatArrayParam } from "@xeokit/math";
/**
 * {@link Transform} creation parameters for {@link @xeokit/scene!SceneModel.createTransform | SceneModel.createTransform}.
 */
export interface TransformParams {
    /**
     * ID for the transform.
     */
    id: string;
    /**
     * ID of the parent transform.
     */
    parentTransformId?: string;
    /**
     * 4x4 matrix that defines the transformation.
     */
    matrix: FloatArrayParam;
}
