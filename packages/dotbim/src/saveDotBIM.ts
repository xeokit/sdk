import {DataModel} from "@xeokit/data";
import {SceneModel} from "@xeokit/scene";
import {SDKError} from "@xeokit/core/components";


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
 * @returns {@link @xeokit/core/components!SDKError} If the SceneModel has already been destroyed.
 * @returns {@link @xeokit/core/components!SDKError} If the SceneModel has not yet been built.
 * @returns {@link @xeokit/core/components!SDKError} If the DataModel has already been destroyed.
 * @returns {@link @xeokit/core/components!SDKError} If the DataModel has not yet been built.
 */
export function saveDotBIM(params: {
    sceneModel?: SceneModel,
    dataModel?: DataModel
}): ArrayBuffer {
    const sceneModel = params.sceneModel
    const dataModel = params.dataModel;
    if (sceneModel.destroyed) {
        throw new SDKError("SceneModel already destroyed");
    }
    if (!sceneModel.built) {
        throw new SDKError("SceneModel not yet built");
    }
    if (dataModel) {
        if (dataModel.destroyed) {
            throw new SDKError("DataModel already destroyed");
        }
        if (!dataModel.built) {
            throw new SDKError("DataModel not yet built");
        }
    }
    return modelToDotBIM({sceneModel, dataModel});
}

function modelToDotBIM(param: { dataModel: DataModel; sceneModel: SceneModel }) {
    return undefined;
}