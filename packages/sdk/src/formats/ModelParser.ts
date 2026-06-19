import type {ModelParseParams} from "./ModelParseParams";

/**
 * Parses geometry and semantic data from a model file into a {@link model!scene.SceneModel | SceneModel}
 * and/or a {@link model!data.DataModel | DataModel}.
 *
 * `options` is loader-specific — each parser narrows it to its own format
 * options type (a subtype of {@link ModelLoadOptions}), so it is `any` here.
 *
 * @internal
 */
export type ModelParser = (params: ModelParseParams, options?: any) => Promise<any>;
