import type { DataModel } from "@xeokit/data";
import type { SceneModel } from "@xeokit/scene";
/**
 * Exports a {@link @xeokit/scene!SceneModel | SceneModel} and/or a {@link @xeokit/data!DataModel} to a JSON object
 * containing .BIM file data.
 *
 * See {@link @xeokit/dotbim} for usage.
 *
 * @param params
 * @param params.model - The SceneModel to export to .BIM.
 * @param params.dataModel - The DataModel to export to .BIM.
 * @returns The .BIM file data in an JSON object.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the SceneModel has not yet been built.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core!SDKError} If the DataModel has not yet been built.
 */
export declare function saveDotBIM(params: {
    sceneModel: SceneModel;
    dataModel: DataModel;
}): Object;
