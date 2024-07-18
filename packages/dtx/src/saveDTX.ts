import {SDKError} from "@xeokit/core";
import type {DataModel} from "@xeokit/data";
import type {SceneModel} from "@xeokit/scene";
import {deflateDTX} from "./deflateDTX";
import {modelToDTX} from "./modelToDTX";
import {packDTX} from "./packDTX";

/**
 * Exports a {@link @xeokit/scene!SceneModel | SceneModel} to an ArrayBuffer
 * containing [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data.
 *
 * See {@link "@xeokit/dtx" | @xeokit/dtx} for usage.
 *
 * See {@link @xeokit/dtx!DTXData} for insights into the structure of a [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file.
 *
 * @param params
 * @param params.sceneModel - The SceneModel to export to DTX.
 * @returns The [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#dtx) file data in an ArrayBuffer.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has not yet been built.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has not yet been built.
 */
export function saveDTX(params: {
    sceneModel: SceneModel
}): ArrayBuffer {
    if (params.sceneModel.destroyed) {
        throw new SDKError("SceneModel already destroyed");
    }
    if (!params.sceneModel.built) {
        throw new SDKError("SceneModel not yet built");
    }
    return packDTX(deflateDTX(modelToDTX({
        sceneModel: params.sceneModel
    })));
}
