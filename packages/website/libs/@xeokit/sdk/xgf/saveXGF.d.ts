import { SDKError } from "../core";
import { SceneModel } from "../scene";
/**
 * The XGF versions supported by {@link xgf!saveXGF | saveXGF}.
 */
export declare const SAVED_XGF_VERSIONS: number[];
/**
 * The default XGF version saved by {@link xgf!saveXGF | saveXGF}. This equals the maximum
 * value in {@link xgf!SAVED_XGF_VERSIONS | SAVED_XGF_VERSIONS}.
 */
export declare const DEFAULT_SAVED_XGF_VERSION: number;
/**
 * Exports a {@link scene!SceneModel | SceneModel} to an ArrayBuffer
 * containing [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) file data.
 *
 * See {@link "xgf" | xgf} for usage.
 *
 * @param params
 * @param params.sceneModel - The SceneModel to export to XGF.
 * @param params.xgfVersion - The XGF format version to write. Must be one of the values in {@link xgf!SAVED_XGF_VERSIONS | SAVED_XGF_VERSIONS}. Defaults to the value of {@link xgf!DEFAULT_SAVED_XGF_VERSION | DEFAULT_SAVED_XGF_VERSION}.
 * @returns The [XGF](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#xgf) file data in an ArrayBuffer.
 * @returns {@link core!SDKError | SDKError} If the SceneModel has already been destroyed.
 * @returns {@link core!SDKError | SDKError} If the SceneModel has not yet been built.
 * @returns {@link core!SDKError | SDKError} Unsupported XGF version (fix by upgrading @xeokit/sdk).
 */
export declare function saveXGF(params: {
    sceneModel: SceneModel;
    xgfVersion?: number;
}): ArrayBuffer | SDKError;
//# sourceMappingURL=saveXGF.d.ts.map