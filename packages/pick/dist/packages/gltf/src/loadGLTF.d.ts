import { SceneModel } from "@xeokit/scene";
import { DataModel } from "@xeokit/data";
/**
 * Loads glTF file data from an ArrayBuffer into a {@link @xeokit/scene!SceneModel | SceneModel} and/or
 * a {@link @xeokit/data!DataModel | DataModel}.
 *
 * * Expects {@link @xeokit/scene!SceneModel.built | SceneModel.built} and {@link @xeokit/scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link @xeokit/scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link @xeokit/gltf} for usage.
 *
 * @param params - Loading parameters.
 * @param params.data - glTF file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into. For glTF, this will create a basic aggregation hierarchy (see {@link "@xeokit/datatypes/basicTypes"}).
 * @returns {Promise} Resolves when glTF has been loaded.
 */
export declare function loadGLTF(params: {
    data: ArrayBuffer;
    sceneModel: SceneModel;
    dataModel?: DataModel;
    log?: Function;
}): Promise<any>;
