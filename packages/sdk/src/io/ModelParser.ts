import type {ModelParseParams} from "./ModelParseParams";

/**
 * Parses geometry and semantic data from a model file into a {@link scene!SceneModel | scene!SceneModel}
 * and/or a {@link data!DataModel | data!DataModel}.
 */
export type ModelParser = (params: ModelParseParams, options?: any) => Promise<any>;
