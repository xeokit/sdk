import { SceneModel } from "../scene";
import { DataModel } from "../data";
import * as WebIFC from "web-ifc";
/**
 * Uses WebIFc to load an IFC file into a {@link scene!SceneModel | SceneModel} and/or {@link data!DataModel | DataModel}.
 *
 * * Experimental  - expect some glitches.
 * * Expects {@link scene!SceneModel.built | SceneModel.built} and {@link scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link "webifc" | @xeokit/webifc} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - IFC file contents.
 * @param params.ifcAPI - WebIFC API.
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @returns {Promise} Resolves when IFC has been loaded into the SceneModel and/or DataModel.
 * @throws *{@link core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export declare function loadWebIFC(params: {
    fileData: any;
    ifcAPI: WebIFC.IfcAPI;
    sceneModel?: SceneModel;
    dataModel?: DataModel;
}): Promise<any>;
//# sourceMappingURL=loadWebIFC.d.ts.map