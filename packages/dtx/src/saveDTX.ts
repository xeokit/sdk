import {SDKError} from "@xeokit/core";
import {SceneModel} from "@xeokit/scene";
import {writeDTX as writeDTX_v1} from "./versions/v1/writeDTX";

const writers = {
    1: writeDTX_v1
};

/**
 * The DTX versions supported by {@link @xeokit/dtx!saveDTX | saveDTX}.
 */
export const SAVED_DTX_VERSIONS: number[] = Object.keys(writers).map(Number);

/**
 * The default DTX version saved by {@link @xeokit/dtx!saveDTX | saveDTX}. This equals the maximum
 * value in {@link @xeokit/dtx!SAVED_DTX_VERSIONS | SAVED_DTX_VERSIONS}.
 */
export const DEFAULT_SAVED_DTX_VERSION: number = Math.max(...SAVED_DTX_VERSIONS);

/**
 * Exports a {@link @xeokit/scene!SceneModel | SceneModel} to an ArrayBuffer
 * containing [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data.
 *
 * See {@link "@xeokit/dtx" | @xeokit/dtx} for usage.
 *
 * @param params
 * @param params.sceneModel - The SceneModel to export to DTX.
 * @param params.dtxVersion - The DTX format version to write. Must be one of the values in {@link @xeokit/dtx!SAVED_DTX_VERSIONS | SAVED_DTX_VERSIONS}. Defaults to the value of {@link @xeokit/dtx!DEFAULT_SAVED_DTX_VERSION | DEFAULT_SAVED_DTX_VERSION}.
 * @returns The [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data in an ArrayBuffer.
 *
 * TODO
 *
 * @returns {@link @xeokit/core!SDKError | SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError | SDKError} If the SceneModel has not yet been built.
 */
export function saveDTX(params: {
    sceneModel: SceneModel,
    dtxVersion?: number
}): ArrayBuffer | SDKError {
    if (!params) {
        return new SDKError("Argument expected: params");
    }
    const {sceneModel, dtxVersion = DEFAULT_SAVED_DTX_VERSION} = params;
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
    const writeDTX = writers[dtxVersion];
    if (!writeDTX) {
        return new SDKError(`Unsupported DTX file version: ${dtxVersion} - supported versions are [${SAVED_DTX_VERSIONS}]`);
    }
    return writeDTX({
        sceneModel
    });
}
