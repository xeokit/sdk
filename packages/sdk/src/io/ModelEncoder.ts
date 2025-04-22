import {ModelEncodeParams} from "./ModelEncodeParams";

/**
 * Encodes geometry and semantic data within a {@link scene!SceneModel | scene!SceneModel}
 * and/or a {@link data!DataModel | data!DataModel} into model file data.
 */
export type ModelEncoder = (params: ModelEncodeParams, options?: any) => Promise<any>;
