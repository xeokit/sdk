import type { SceneModel } from "@xeokit/scene";
import type { DataModel } from "@xeokit/data";
/**
 * Imports XKT file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel}
 * and/or a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and
 * {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Expects {@link @xeokit/data!DataModel.built | DataModel.built} and
 * {@link @xeokit/data!DataModel.destroyed | DataModel.destroyed} to be ````false````
 *
 * See {@link @xeokit/xkt} for usage.
 *
 * See {@link XKTData} for insights into the structure of an XKT file.
 *
 * @param params - Loading parameters.
 * @param params.data - XKT file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - Optional DataModel to load into.
 * @returns {Promise} Resolves when XKT has been loaded.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been built.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been built.
 */
export declare function loadXKT(params: {
    data: ArrayBuffer;
    sceneModel: SceneModel;
    dataModel?: DataModel;
}): Promise<any>;
