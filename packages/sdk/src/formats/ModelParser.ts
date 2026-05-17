import type {ModelParseParams} from "./ModelParseParams";
import type {ModelLoadOptions} from "./ModelLoadOptions";

/**
 * Parses geometry and semantic data from a model file into a {@link model!scene.SceneModel | SceneModel}
 * and/or a {@link model!data.DataModel | DataModel}.
 *
 * @internal
 */
export type ModelParser = (params: ModelParseParams, options?: ModelLoadOptions) => Promise<any>;
