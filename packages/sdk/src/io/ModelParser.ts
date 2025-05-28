import type {ModelParseParams} from "./ModelParseParams";
import type {ModelLoadOptions} from "./ModelLoadOptions";

/**
 * Parses geometry and semantic data from a model file into a {@link scene!SceneModel | scene!SceneModel}
 * and/or a {@link data!DataModel | data!DataModel}.
 */
export type ModelParser = (params: ModelParseParams, options?: ModelLoadOptions) => Promise<any>;
