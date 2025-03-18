import { SceneModel } from "../scene";
import { DataModel } from "../data";
import { FloatArrayParam } from "../math";
/**
 * Loads LAS/LAZ file data from an ArrayBuffer into a {@link scene!SceneModel | SceneModel} and/or a {@link data!DataModel | DataModel}.
 *
 * * Expects {@link scene!SceneModel.built | SceneModel.built} and {@link scene!SceneModel.destroyed | SceneModel.destroyed} to be ````false````
 * * Does not call {@link scene!SceneModel.build | SceneModel.build} - we call that ourselves, when we have finished building the SceneModel
 *
 * See {@link las | @xeokit/sdk/las} for usage.
 *
 * @param params - Loading parameters.
 * @param params.fileData - LAS/LAZ file data
 * @param params.sceneModel - SceneModel to load into.
 * @param params.dataModel - DataModel to load into.
 * @param options - Loading parameters.
 * @param options.center - Whether to center the points. Default is false.
 * @param options.transform - Optional flattened 4x4 matrix to transform the points. Applied after centering, if specified.
 * @param options.skip - Option to oad every **n** points. Default is 1.
 * @param options.fp64 - Whether to assume that LAS positions are stored in 64-bit floats instead of 32-bit. Default is true.
 * @param options.colorDepth - Whether to assume that LAS colors are encoded using 8 or 16 bits. Accepted values are 8, 16 an "auto".
 * @returns {Promise} Resolves when LAS has been loaded.
 * @throws *{@link core!SDKError | SDKError}*
 * * If the SceneModel has already been destroyed.
 * * If the SceneModel has already been built.
 * * If the DataModel has already been destroyed.
 * * If the DataModel has already been built.
 */
export declare function loadLAS(params: {
    fileData: ArrayBuffer;
    sceneModel: SceneModel;
    dataModel?: DataModel;
    log?: Function;
}, options?: {
    center?: boolean;
    transform?: FloatArrayParam;
    skip?: number;
    fp64?: boolean;
    colorDepth?: string | number;
}): Promise<void>;
//# sourceMappingURL=loadLAS.d.ts.map