import { SceneModel } from "../scene";
import { DataModel } from "../data";
/**
 * Loads glTF file data into a {@link scene!SceneModel | SceneModel} and/or
 * a {@link data!DataModel | DataModel}.
 *
 * This function allows you to load geometry and material color data from a glTF file
 * into the {@link scene!SceneModel | SceneModel}, while basic semantic data is
 * loaded into the {@link data!DataModel | DataModel}. For glTF, this will create a
 * basic aggregation hierarchy (see {@link basictypes | @xeokit/sdk/basictypes}).
 *
 * **Important:**
 * - Expects {@link scene!SceneModel.built | SceneModel.built} and
 *   {@link scene!SceneModel.destroyed | SceneModel.destroyed} to be `false`.
 * - Does not invoke {@link scene!SceneModel.build | SceneModel.build}, which is done separately after the SceneModel has been fully loaded.
 *
 * See {@link gltf | @xeokit/sdk/gltf} for usage.
 *
 * @param params - The parameters required for loading glTF file data.
 * @param params.fileData - The glTF file data to load into the models.
 * @param params.sceneModel - The {@link scene!SceneModel | SceneModel} to load geometry and material color data into.
 * @param params.dataModel - The {@link data!DataModel | DataModel} to load basic semantic data into. This creates a basic aggregation hierarchy for glTF files.
 *
 * @returns {Promise} Resolves when the glTF data has been successfully loaded into the SceneModel and/or DataModel.
 *
 * @throws {@link core!SDKError | SDKError}
 * - If the {@link scene!SceneModel | SceneModel} has already been destroyed.
 * - If the {@link scene!SceneModel | SceneModel} has already been built.
 * - If the {@link data!DataModel | DataModel} has already been destroyed.
 * - If the {@link data!DataModel | DataModel} has already been built.
 */
export declare function GLTFLoader(params: {
    fileData: any;
    sceneModel?: SceneModel;
    dataModel?: DataModel;
    log?: Function;
}): Promise<any>;
//# sourceMappingURL=GLTFLoader.d.ts.map
