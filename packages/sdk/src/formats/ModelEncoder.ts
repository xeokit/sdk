import type {ModelEncodeParams} from "./ModelEncodeParams";

/**
 * Encodes geometry and semantic data within a {@link model!scene.SceneModel | SceneModel}
 * and/or a {@link model!data.DataModel | DataModel} into model file data.
 * @internal
 */
export type ModelEncoder = (params: ModelEncodeParams, options?: any) => Promise<any>;
