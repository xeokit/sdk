import { SceneModel } from "../scene";
import { DataModel } from "../data";
import { ModelChunksManifestParams } from "../core";
/**
 * Loads a SceneModel and/or DataModel from a set of chunk files.
 *
 * See {@link modelchunksloader | @xeokit/sdk/modelchunksloader} for usage.
 *
 * @param params
 */
export declare class ModelChunksLoader {
    #private;
    constructor(params: {
        sceneModelLoader: any;
        dataModelLoader: any;
        mimeType: string;
    });
    cancel(): void;
    get cancelled(): boolean;
    /**
     * Loads the geometry and data models listed in a ModelChunksManifestParams into a SceneModel and DataModel.
     *
     * Loading can be interrupted at any time by calling {@link modelchunksloader/ModelChunksLoader.cancel | ModelChunksLoader.cancel}.
     *
     * @param params
     * @returns {Promise} Resolves when all models have been loaded.
     */
    load(params: {
        modelChunksManifest: ModelChunksManifestParams;
        baseDir: string;
        sceneModel?: SceneModel;
        dataModel?: DataModel;
    }): Promise<void>;
}
//# sourceMappingURL=ModelChunksLoader.d.ts.map