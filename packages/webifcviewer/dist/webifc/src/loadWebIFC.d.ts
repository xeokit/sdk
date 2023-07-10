import type { SceneModel } from "@xeokit/scene";
import type { DataModel } from "@xeokit/data";
import * as WebIFC from "web-ifc/web-ifc-api-node";
/**
 * Loads IFC into a {@link @xeokit/scene!SceneModel | SceneModel} and/or {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link @xeokit/webifc} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - IFC file contents.
 * @param params.ifcAPI - WebIFC API.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @returns {Promise} Resolves when IFC has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link @xeokit/core!SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export declare function loadWebIFC(params: {
    fileData: ArrayBuffer;
    ifcAPI: WebIFC.IfcAPI;
    sceneModel: SceneModel;
    dataModel?: DataModel;
}): Promise<any>;
