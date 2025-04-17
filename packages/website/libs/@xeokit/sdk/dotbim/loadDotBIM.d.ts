import { SceneModel } from "../scene";
import { DataModel } from "../data";
import { FloatArrayParam } from "../math";
/**
 * Loads a .BIM file into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * This function expects the following conditions:
 * - The {@link scene!SceneModel.built | SceneModel.built} and {@link scene!SceneModel.destroyed | SceneModel.destroyed} properties must be `false`.
 * - It does not invoke the {@link scene!SceneModel.build | SceneModel.build} method; it is called separately when the SceneModel is fully constructed.
 *
 * This method provides flexibility for loading .BIM data into both a SceneModel and DataModel simultaneously,
 * depending on the provided parameters.
 *
 * For further usage, refer to {@link dotbim | @xeokit/sdk/dotbim}.
 *
 * @param params - The parameters used for loading the .BIM data.
 * @param params.fileData - The JSON .BIM file data to load.
 * @param params.sceneModel - The {@link scene!SceneModel | SceneModel} into which the .BIM data will be loaded.
 * @param params.dataModel - The {@link data!DataModel | DataModel} into which the .BIM data will be loaded.
 * @param options - Options for customizing the loading process.
 * @param options.error - A callback function that logs any non-fatal errors encountered during the loading process.
 *
 * @returns {Promise} Resolves when the .BIM data has been successfully loaded into the SceneModel and/or DataModel.
 *
 * @throws {@link core!SDKError | SDKError}
 * - If the SceneModel has already been destroyed.
 * - If the SceneModel has already been built.
 * - If the DataModel has already been destroyed.
 * - If the DataModel has already been built.
 */
export declare function DotBIMLoader(params: {
    fileData: any;
    sceneModel?: SceneModel;
    dataModel?: DataModel;
}, options?: {
    translate?: FloatArrayParam;
    error?: (errMsg: string) => void;
}): Promise<any>;
//# sourceMappingURL=DotBIMLoader.d.ts.map
