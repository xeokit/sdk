import { SDKError } from "../core";
import { SceneModel } from "../scene";
import { writeXGF as writeXGF_v1 } from "./versions/v1/writeXGF";
const writers = {
    1: writeXGF_v1
};
/**
 * The XGF versions supported by {@link xgf!saveXGF | saveXGF}.
 */
export const SAVED_XGF_VERSIONS = Object.keys(writers).map(Number);
/**
 * The default XGF version saved by {@link xgf!saveXGF | saveXGF}. This equals the maximum
 * value in {@link xgf!SAVED_XGF_VERSIONS | SAVED_XGF_VERSIONS}.
 */
export const DEFAULT_SAVED_XGF_VERSION = Math.max(...SAVED_XGF_VERSIONS);
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
 *
 * TODO
 *
 * @returns {@link core!SDKError | SDKError} If the SceneModel has already been destroyed.
 * @returns {@link core!SDKError | SDKError} If the SceneModel has not yet been built.
 */
export function saveXGF(params) {
    if (!params) {
        return new SDKError("Argument expected: params");
    }
    const { sceneModel, xgfVersion = DEFAULT_SAVED_XGF_VERSION } = params;
    if (!sceneModel) {
        return new SDKError("Argument expected: params.sceneModel");
    }
    if (!(sceneModel instanceof SceneModel)) {
        return new SDKError("Argument type mismatch: params.sceneModel should be a SceneModel");
    }
    if (sceneModel.destroyed) {
        return new SDKError("SceneModel already destroyed");
    }
    if (!sceneModel.built) {
        return new SDKError("SceneModel not yet built");
    }
    const writeXGF = writers[xgfVersion];
    if (!writeXGF) {
        return new SDKError(`Unsupported XGF file version: ${xgfVersion} - supported versions are [${SAVED_XGF_VERSIONS}]`);
    }
    return writeXGF({
        sceneModel
    });
}
//# sourceMappingURL=saveXGF.js.map